from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import desc
from sqlalchemy.orm import Session, selectinload

from app.auth import FirebaseUser, decode_firebase_token, get_current_user
from app.database import SessionLocal, get_db
from app.listing import page_size
from app.models import Group, GroupMember, GroupMessage, GroupPost, GroupPostComment, User
from app.rate_limit import rate_limit
from app.schemas_group import (
    GroupCommentCreate,
    GroupCommentOut,
    GroupCreate,
    GroupMessageCreate,
    GroupMessageOut,
    GroupOut,
    GroupPostCreate,
    GroupPostOut,
    ToggleLikeIn,
    UpdateGroupPhotoIn,
)
from app.ws_manager import manager

router = APIRouter(prefix="/groups", tags=["groups"])

UserCache = dict[str, User]


def _user_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Perfil do autor nao encontrado.")
    return user


def _load_users(db: Session, ids: list[str]) -> UserCache:
    """Cache local (por chamada) para nao rodar 1 query por linha ao
    serializar uma lista de posts/comentarios/mensagens/grupos."""
    unique_ids = list({i for i in ids if i})
    if not unique_ids:
        return {}
    users = db.query(User).filter(User.uid.in_(unique_ids)).all()
    return {u.uid: u for u in users}


def _author_display(user: User | None) -> tuple[str, str | None]:
    """Nome/foto com fallback usados por post, comentario e mensagem de chat."""
    if not user:
        return "Corredor", None
    return user.display_name, user.photo_url


def _serialize_group(group: Group, users: UserCache) -> GroupOut:
    member_ids = [m.user_id for m in group.members]
    creator = users.get(group.created_by)
    return GroupOut(
        id=group.id,
        name=group.name,
        city=group.city,
        description=group.description,
        tag=group.tag,
        photo_url=group.photo_url,
        created_by=group.created_by,
        creator_name=creator.display_name if creator else "Veloxy",
        member_ids=member_ids,
        members_count=len(member_ids),
        weekly_km=group.weekly_km,
        weekly_km_week=group.weekly_km_week,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.query(Group).options(selectinload(Group.members)).get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo nao encontrado.")
    return group


def _is_group_member(db: Session, group_id: int, user_id: str) -> bool:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
        is not None
    )


def _require_member(db: Session, group_id: int, user_id: str) -> None:
    """Bug real encontrado em revisao: posts/comentarios/mensagens de grupo
    (REST) aceitavam qualquer usuario autenticado, nao so membros do grupo -
    a checagem so existia na conexao WebSocket. Mesma query usada la,
    extraida pra nao duplicar a logica."""
    if not _is_group_member(db, group_id, user_id):
        raise HTTPException(status_code=403, detail="Voce precisa ser membro do grupo.")


@router.get("", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)):
    groups = db.query(Group).options(selectinload(Group.members)).order_by(desc(Group.created_at)).limit(50).all()
    users = _load_users(db, [g.created_by for g in groups])
    return [_serialize_group(g, users) for g in groups]


@router.post("", response_model=GroupOut, dependencies=[Depends(rate_limit("groups:create", 5, 3600))])
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    group = Group(
        name=payload.name.strip(),
        city=payload.city.strip() or "Brasil",
        description=payload.description.strip(),
        tag=payload.tag.strip() or "Run",
        created_by=current_user.uid,
    )
    db.add(group)
    db.flush()

    db.add(GroupMember(group_id=group.id, user_id=current_user.uid))
    db.commit()

    group = _get_group_or_404(db, group.id)
    users = _load_users(db, [group.created_by])
    return _serialize_group(group, users)


@router.websocket("/{group_id}/ws")
async def group_websocket(group_id: int, websocket: WebSocket, token: str = ""):
    """Substitui o polling de 15s do chat/feed/comentarios do grupo. O
    browser nao consegue mandar header Authorization no handshake do
    WebSocket, entao o ID token do Firebase chega via query param
    (?token=...) em vez do Bearer normal."""
    try:
        user = decode_firebase_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        is_member = _is_group_member(db, group_id, user.uid)
    finally:
        db.close()

    if not is_member:
        await websocket.close(code=4403)
        return

    await manager.connect(group_id, websocket)
    try:
        while True:
            # Conexao e so push (servidor -> cliente); ainda precisamos
            # aguardar aqui pra detectar quando o cliente desconecta.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(group_id, websocket)


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)):
    group = _get_group_or_404(db, group_id)
    users = _load_users(db, [group.created_by])
    return _serialize_group(group, users)


@router.put("/{group_id}/photo", response_model=GroupOut, dependencies=[Depends(rate_limit("groups:photo", 10, 600))])
def update_group_photo(
    group_id: int,
    payload: UpdateGroupPhotoIn,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    group = _get_group_or_404(db, group_id)
    if group.created_by != current_user.uid:
        raise HTTPException(status_code=403, detail="So quem criou o grupo pode trocar a foto.")

    group.photo_url = payload.photo_url
    group.updated_at = datetime.now(timezone.utc)
    db.commit()

    group = _get_group_or_404(db, group_id)
    users = _load_users(db, [group.created_by])
    return _serialize_group(group, users)


@router.post("/{group_id}/join", response_model=GroupOut, dependencies=[Depends(rate_limit("groups:membership", 20, 60))])
def join_group(
    group_id: int, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(get_current_user)
):
    group = _get_group_or_404(db, group_id)
    already_member = any(m.user_id == current_user.uid for m in group.members)
    if not already_member:
        db.add(GroupMember(group_id=group_id, user_id=current_user.uid))
        group.updated_at = datetime.now(timezone.utc)
        db.commit()

    group = _get_group_or_404(db, group_id)
    users = _load_users(db, [group.created_by])
    return _serialize_group(group, users)


@router.post("/{group_id}/leave", response_model=GroupOut, dependencies=[Depends(rate_limit("groups:membership", 20, 60))])
def leave_group(
    group_id: int, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(get_current_user)
):
    group = _get_group_or_404(db, group_id)
    db.query(GroupMember).filter(
        GroupMember.group_id == group_id, GroupMember.user_id == current_user.uid
    ).delete()
    group.updated_at = datetime.now(timezone.utc)
    db.commit()

    group = _get_group_or_404(db, group_id)
    users = _load_users(db, [group.created_by])
    return _serialize_group(group, users)


# ─── Posts ──────────────────────────────────────────────────────────────────


def _serialize_post(post: GroupPost, author: User | None) -> GroupPostOut:
    author_name, author_photo = _author_display(author)
    return GroupPostOut(
        id=str(post.id),
        author_id=post.author_id,
        author_name=author_name,
        author_photo=author_photo,
        text=post.text,
        image_url=post.image_url,
        likes=list(post.likes or []),
        comments_count=post.comments_count,
        created_at=post.created_at,
    )


@router.get("/{group_id}/posts", response_model=list[GroupPostOut])
def list_group_posts(
    group_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    posts = (
        db.query(GroupPost)
        .filter(GroupPost.group_id == group_id)
        .order_by(desc(GroupPost.created_at))
        .limit(page_size(limit))
        .all()
    )
    users = _load_users(db, [p.author_id for p in posts])
    return [_serialize_post(p, users.get(p.author_id)) for p in posts]


@router.post("/{group_id}/posts", response_model=GroupPostOut, dependencies=[Depends(rate_limit("groups:post", 10, 60))])
async def create_group_post(
    group_id: int,
    payload: GroupPostCreate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    author = _user_or_404(db, current_user.uid)
    post = GroupPost(
        group_id=group_id,
        author_id=current_user.uid,
        text=payload.text.strip(),
        image_url=payload.image_url,
        likes=[],
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    result = _serialize_post(post, author)
    await manager.broadcast(group_id, {"type": "post_created"})
    return result


@router.post("/{group_id}/posts/{post_id}/like", dependencies=[Depends(rate_limit("groups:post-like", 60, 60))])
async def toggle_group_post_like(
    group_id: int,
    post_id: int,
    payload: ToggleLikeIn,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    post = db.query(GroupPost).filter(GroupPost.id == post_id, GroupPost.group_id == group_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Publicacao nao encontrada.")

    likes = list(post.likes or [])
    if payload.is_liked:
        if current_user.uid in likes:
            likes.remove(current_user.uid)
    else:
        if current_user.uid not in likes:
            likes.append(current_user.uid)
    post.likes = likes
    db.commit()
    await manager.broadcast(group_id, {"type": "post_like", "postId": str(post_id)})
    return {"likes": likes}


# ─── Comentários ────────────────────────────────────────────────────────────


def _serialize_comment(comment: GroupPostComment, author: User | None) -> GroupCommentOut:
    author_name, author_photo = _author_display(author)
    return GroupCommentOut(
        id=str(comment.id),
        author_id=comment.author_id,
        author_name=author_name,
        author_photo=author_photo,
        text=comment.text,
        created_at=comment.created_at,
    )


@router.get("/{group_id}/posts/{post_id}/comments", response_model=list[GroupCommentOut])
def list_group_post_comments(
    group_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    comments = (
        db.query(GroupPostComment)
        .filter(GroupPostComment.post_id == post_id)
        .order_by(GroupPostComment.created_at.asc())
        .limit(200)
        .all()
    )
    users = _load_users(db, [c.author_id for c in comments])
    return [_serialize_comment(c, users.get(c.author_id)) for c in comments]


@router.post("/{group_id}/posts/{post_id}/comments", response_model=GroupCommentOut, dependencies=[Depends(rate_limit("groups:comment", 20, 60))])
async def add_group_post_comment(
    group_id: int,
    post_id: int,
    payload: GroupCommentCreate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    author = _user_or_404(db, current_user.uid)
    post = db.query(GroupPost).filter(GroupPost.id == post_id, GroupPost.group_id == group_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Publicacao nao encontrada.")

    comment = GroupPostComment(post_id=post_id, author_id=current_user.uid, text=payload.text.strip())
    db.add(comment)
    post.comments_count = (post.comments_count or 0) + 1
    db.commit()
    db.refresh(comment)
    result = _serialize_comment(comment, author)
    await manager.broadcast(group_id, {"type": "comment_created", "postId": str(post_id)})
    return result


# ─── Chat ───────────────────────────────────────────────────────────────────


def _serialize_message(message: GroupMessage, sender: User | None) -> GroupMessageOut:
    sender_name, sender_photo = _author_display(sender)
    return GroupMessageOut(
        id=str(message.id),
        sender_id=message.sender_id,
        sender_name=sender_name,
        sender_photo=sender_photo,
        text=message.text,
        created_at=message.created_at,
    )


@router.get("/{group_id}/messages", response_model=list[GroupMessageOut])
def list_group_messages(
    group_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    messages = (
        db.query(GroupMessage)
        .filter(GroupMessage.group_id == group_id)
        .order_by(desc(GroupMessage.created_at))
        .limit(page_size(limit))
        .all()
    )
    messages = list(reversed(messages))
    users = _load_users(db, [m.sender_id for m in messages])
    return [_serialize_message(m, users.get(m.sender_id)) for m in messages]


@router.post("/{group_id}/messages", response_model=GroupMessageOut, dependencies=[Depends(rate_limit("groups:message", 30, 60))])
async def send_group_message(
    group_id: int,
    payload: GroupMessageCreate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.uid)
    sender = _user_or_404(db, current_user.uid)
    message = GroupMessage(group_id=group_id, sender_id=current_user.uid, text=payload.text.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    result = _serialize_message(message, sender)
    await manager.broadcast(group_id, {"type": "message_created"})
    return result


# ─── Usado por outros dominios ──────────────────────────────────────────────


@router.get("/joined/{user_id}", response_model=list[str])
def get_joined_group_ids(
    user_id: str, db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)
):
    """IDs dos grupos reais (Postgres) de que o usuario participa. Usado por
    getUserProfile no frontend para mesclar com joinedGroupIds do Firestore
    (grupos demo/fallback, que nao tem linha correspondente aqui)."""
    rows = db.query(GroupMember.group_id).filter(GroupMember.user_id == user_id).all()
    return [str(group_id) for (group_id,) in rows]
