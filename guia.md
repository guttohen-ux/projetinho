## Tarefas — Responsividade e bug de duplicação no WebSocket

### 1. Implementar responsividade
- **Problema:** o projeto funciona bem no PC, mas não está adaptado para celular, tablet e outros dispositivos com tela menor.
- **Ação:** implementar responsividade geral na interface.
- **Requisito específico:** para dispositivos com largura de tela abaixo de aproximadamente **768px**, transformar a navegação/aba lateral em um painel deslizante (slide-in/slide-out) em vez do layout fixo atual.

### 2. Corrigir bug de duplicação no WebSocket
- **Contexto:** o WebSocket está funcionando bem para status online/offline (testado via celular).
- **Bug:** ao realizar uma ação (ex: criar uma tabela), a alteração é **duplicada** para quem a criou, enquanto para os demais usuários conectados o comportamento aparenta ser normal.
- **Ação:**
  1. Revisar o código responsável pela emissão e escuta dos eventos WebSocket.
  2. Identificar os pontos suspeitos — prováveis causas comuns:
     - Atualização otimista no cliente (ex: adiciona localmente ao criar) **somada** ao evento recebido de volta pelo próprio servidor/broadcast.
     - Listener duplicado (ex: `useEffect` sem cleanup, registrando o mesmo evento mais de uma vez).
     - Servidor fazendo broadcast para "todos" em vez de "todos exceto o remetente".
  3. Corrigir a lógica identificada.