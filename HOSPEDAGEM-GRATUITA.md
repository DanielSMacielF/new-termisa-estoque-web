# New Termisa — HTTPS sem GitHub na URL

O sistema está preparado para **Firebase Hosting (clássico)**, usando o mesmo projeto Firebase já utilizado no estoque: `new-termisa-estoque`.

## Segurança da publicação

O comando `node preparar-hosting.js` cria a pasta `hosting-dist` com **somente** estes arquivos:

- `index.html` — aplicativo principal
- `inteligencia.html` — Central de Inteligência
- `calculadora.js` — calculadora flutuante

Outros arquivos do repositório, como versões antigas e backups, não são publicados. A pasta `hosting-dist` é gerada automaticamente e ignorada pelo Git. A publicação de Hosting **não modifica os dados ou as regras do Firestore**.

## Primeira publicação (notebook)

1. Baixe o ZIP atualizado do repositório no GitHub e descompacte, ou abra o repositório local no VS Code.
2. Abra o terminal na pasta que contém `index.html` e `firebase.json`.
3. Se ainda não tiver o Firebase CLI, instale com `npm install -g firebase-tools`.
4. Execute `firebase login` e autorize **a conta Google que administra o projeto** `new-termisa-estoque`.
5. Execute `firebase projects:list` e confirme que o projeto está na lista.
6. Execute `node preparar-hosting.js`.
7. Execute `firebase deploy --only hosting --project new-termisa-estoque`.
8. Confira a URL **Hosting URL** mostrada ao final. Quando for o domínio padrão, normalmente será `https://new-termisa-estoque.web.app/`, mas use o endereço retornado pelo Firebase.

Se o Firebase solicitar que seja criado o site padrão de Hosting, escolha o ID do projeto `new-termisa-estoque` se estiver disponível.

## Verificação antes de compartilhar

- Confira o login e os perfis de acesso com uma conta já autorizada.
- Confira a lista de materiais e quantidades contra o endereço antigo (sem realizar movimentações de teste no estoque real).
- Teste a Central de Inteligência, PDF e calculadora.
- Confirme se o domínio foi adicionado em Firebase Console → Authentication → Settings → Authorized domains, caso alguma operação de autenticação exija isso.
- Não divulgue uma URL antes de ela estar publicada e testada.

## Nas próximas atualizações

Na pasta local com os arquivos mais recentes do GitHub, execute:

```powershell
node preparar-hosting.js
firebase deploy --only hosting --project new-termisa-estoque
```

O endereço antigo do GitHub continua funcionando até que você decida interrompê-lo. **Usar o Firebase Hosting não torna o repositório GitHub privado** e não substitui as regras de segurança do Firestore.

## Custos

O Firebase Hosting clássico tem limites gratuitos no plano Spark; pode ser usado sem cartão, sujeito às cotas da conta. Não é o mesmo produto que Firebase App Hosting.
