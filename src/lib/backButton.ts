// Pilha de ações do botão "voltar" do Android.
// Quem está por cima (o modal aberto mais recente) recebe o toque primeiro.
// Se a pilha estiver vazia, o listener global volta de tela ou sai do app.

type BackHandler = () => void;

const stack: { id: number; handler: BackHandler }[] = [];
let nextId = 0;

/** Registra uma ação para o botão voltar. Retorna a função que a remove. */
export function pushBackHandler(handler: BackHandler): () => void {
  const id = nextId++;
  stack.push({ id, handler });
  return () => {
    const index = stack.findIndex(entry => entry.id === id);
    if (index >= 0) stack.splice(index, 1);
  };
}

/** Executa a ação do topo. Retorna false se não havia nenhuma. */
export function runTopBackHandler(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.handler();
  return true;
}

/** Telas em que voltar sai do app em vez de navegar. */
export const ROOT_PATHS = new Set(["/", "/home", "/login"]);
