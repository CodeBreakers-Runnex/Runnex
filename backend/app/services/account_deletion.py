"""Exclusao de conta (DELETE /users/{uid}): apaga do Postgres tudo que
pertence ao usuario.

O que o banco ja resolve sozinho ao apagar a linha de users (ON DELETE
CASCADE / cascade do ORM): corridas, participacao em grupos e eventos,
posts, comentarios, mensagens de chat e a memoria do treinador virtual
(chatbot_profiles). O que precisa de tratamento aqui:

- groups.created_by e RESTRICT: apagar o grupo levaria junto posts e
  mensagens de outras pessoas, entao o grupo passa para o membro mais
  antigo e so e apagado se nao sobrar ninguem.
- likes sao arrays de uid (sem FK): o uid sai das curtidas alheias.
- posts.comments_count e um contador desnormalizado: desconta os
  comentarios do usuario em posts de outras pessoas.
"""

from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.models import Activity, Group, GroupMember, GroupPost, GroupPostComment, User


def delete_account(db: Session, uid: str) -> None:
    user = db.get(User, uid)
    if not user:
        return

    for group in db.query(Group).filter(Group.created_by == uid).all():
        heir = (
            db.query(GroupMember)
            .filter(GroupMember.group_id == group.id, GroupMember.user_id != uid)
            .order_by(GroupMember.joined_at, GroupMember.id)
            .first()
        )
        if heir:
            group.created_by = heir.user_id
        else:
            db.delete(group)

    comment_counts = (
        db.query(GroupPostComment.post_id, func.count())
        .filter(GroupPostComment.author_id == uid)
        .group_by(GroupPostComment.post_id)
        .all()
    )
    for post_id, count in comment_counts:
        db.execute(
            update(GroupPost)
            .where(GroupPost.id == post_id)
            .values(comments_count=func.greatest(GroupPost.comments_count - count, 0))
        )

    for model in (Activity, GroupPost):
        db.execute(
            update(model).where(model.likes.any(uid)).values(likes=func.array_remove(model.likes, uid))
        )

    db.delete(user)
    db.commit()
