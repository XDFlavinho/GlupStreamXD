# GlupStreamXD 2.0.1 — Windows e Android

Chat com perfis e figurinhas, compartilhamento de tela para **até 10 espectadores além do host**, ajuda, apoio e estatísticas. Electron + HTML/CSS/JavaScript puro + PeerJS. Sem cadastro ou servidor dedicado próprio.

## Atualizar

Instale `GlupStreamXD-2.0.1-x64-Setup.exe` no Windows. No canto superior direito, abra **Ajuda → Salvar APK Android**. Transfira o APK para o celular e instale-o. Também é possível usar o arquivo Android entregue separadamente.

Use **2.0.1 em todos os participantes**. O protocolo de grupo não é compatível com a versão 1.0. O APK mantém o mesmo identificador e a mesma chave de desenvolvimento da entrega anterior, permitindo atualização sobre ela. A versão Windows continua sem assinatura digital comercial.

## Começar

1. Abra **Perfil** no topo, escolha um nome e uma foto e salve. O perfil fica neste dispositivo e é enviado às pessoas da sala.
2. No PC do host, clique em **Criar Sala** e compartilhe o ID/convite.
3. Cada espectador, no Windows ou Android, usa **Entrar em Sala**. A sala aceita o host e 10 espectadores.
4. Na aba **Transmissão** do host, escolha qualidade/FPS, marque áudio do sistema se desejar, clique em iniciar e escolha a fonte.
5. Os vídeos abrem automaticamente nos espectadores. O Android continua somente como espectador.
6. Todos podem conversar. O botão de carinha abre figurinhas prontas ou importa PNG/JPG/WebP como figurinha.
7. O botão **Participantes** mostra quem está conectado. Sair de um espectador não encerra a sala; sair do host encerra para todos.

Mensagens não são gravadas em disco. O chat mantém até 200 itens em memória, com até 4.000 caracteres por mensagem. Figurinhas importadas são estáticas, têm até 256 px e um limite de tamanho no protocolo. Arquivos originais podem ter até 5 MB. Fotos são reduzidas para até 96 px. Somente o perfil é persistido, usando armazenamento local do Electron/WebView. Alterações de nome/foto refletem nas mensagens novas.

## Ajuda e apoio

O botão **Ajuda** fica no topo e contém tutorial, APK Android embarcado, dicas de qualidade e contribuição opcional. O Pix Copia e Cola informado foi preservado e seu CRC conferido. O botão LivePix abre somente `https://livepix.gg/xdflaviooo` no navegador externo. Nenhuma contribuição é necessária para usar recursos. O app não efetua pagamentos.

Salvar o APK copia o arquivo incluído no instalador para uma pasta escolhida. Não há hospedagem pública nem link de download externo automático. Envie o arquivo salvo por USB ou outro meio de sua preferência. Android 8+ e Android System WebView atualizado são necessários.

## Desempenho e rede

O host faz **uma captura** e envia uma conexão de mídia por espectador. O chat usa topologia em estrela: convidados enviam ao host, que valida a origem e repassa ao grupo. Não há malha de vídeo entre convidados.

Por padrão, o vídeo começa em 720p/30 FPS, com meta de upload total de 12 Mb/s e qualidade automática. O app divide a meta entre os espectadores, reservando 15% para variações e até 64 kb/s de áudio por conexão. Com muitos espectadores e pouca banda por pessoa, reduz resolução para 720p, 480p ou 360p e limita FPS a 24. O limite de bitrate é aplicado aos emissores com `RTCRtpSender.setParameters()`.

Esses valores são metas de payload, não uma garantia ou limite rígido da operadora. Retransmissões e cabeçalhos consomem banda adicional. O WebRTC ainda pode reduzir qualidade conforme a rede. Dez cópias de vídeo exigem upload e processamento: não é possível garantir ausência de travamentos em qualquer PC/conexão. Prefira cabo no host, comece em 720p/30 e escolha uma meta abaixo do upload disponível.

O broker PeerJS público `0.peerjs.com` faz a sinalização. O STUN Google e o TURN OpenRelay mantêm a configuração anterior. TURN e broker gratuitos não têm disponibilidade garantida. O app tenta recuperar a conexão do convidado por 10 segundos; conexões dos demais continuam. O host preserva as conexões já abertas durante uma tentativa de reconexão de sinalização.

## Estatísticas

O botão **Estatísticas** mostra:

- Taxas de envio/recebimento, totais amostrados da sessão, duração, pessoas e gráfico dos últimos 2 minutos.
- Uma linha por conexão de dados ou mídia: taxa, RTT, rota direta/TURN e protocolo, resolução, FPS, perda acumulada, jitter, codec, frames, frames descartados, tempo médio de encode/decode e motivo de limitação.
- Tamanho lógico de chat, perfis e controle em JSON equivalente: diagnóstico, não bytes exatos do transporte binário; não somar ao total WebRTC.

A coleta ocorre a cada 2 segundos, somente nas PeerConnections do aplicativo. Usa bytes do par ICE selecionado e diferenças entre amostras, sem somar novamente os contadores RTP. Totais continuam disponíveis ao sair e reiniciam na próxima sala.

**Escopo exato:** payload WebRTC observado. Exclui sinalização HTTP/WebSocket do broker, abertura do LivePix, cabeçalhos IP/UDP, verificações ICE e tráfego de outros programas. Amostras finais de uma conexão fechada entre coletas podem não ser contabilizadas. Não é um medidor de consumo da operadora nem monitor de rede global do processo. RTT não é a latência ponta a ponta do vídeo. “—” indica campo não disponibilizado pelo navegador. `cpu`, `bandwidth` e `none` vêm do WebRTC.

## Desenvolvimento

Windows 10/11 x64, Node 22.12+ (recomendado 24), npm e internet:

```powershell
npm install
npm start
npm test
npm run test:desktop
npm run build
```

O build gera `dist/GlupStreamXD-2.0.1-x64-Setup.exe` e inclui `android/GlupStreamXD-Android-2.0.1.apk`. Para atualizar o APK embarcado, compile o projeto Android e substitua esse arquivo antes do build do PC. `npm run build:portable` também está disponível.

`renderer/peer.js` contém o protocolo de grupo; `chat.js`, chat e figurinhas; `extras.js`, perfil/ajuda; `stream.js`, captura e distribuição; `stats.js`, métricas; `app.js`, coordenação. Bibliotecas PeerJS e Lucide são locais em `renderer/vendor`. O Android usa uma cópia dos mesmos módulos, com layout adaptável e contêiner Java.

As proteções incluem isolamento de contexto, sandbox, Node desabilitado no renderer, CSP, navegação bloqueada, IPC restrito, validação de imagens/tamanhos, limites de taxa e identidade atribuída pelo host. O ID ainda é o convite: só o compartilhe com quem deve entrar. O host pode ver e encaminhar todas as mensagens da sala.

Veja `VALIDACAO.md` para evidências e limites dos testes.

Referências: [PeerJS](https://peerjs.com/client/api/peer), [WebRTC Statistics](https://www.w3.org/TR/webrtc-stats/), [limites de envio](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters).

## Correção de figurinhas

Atualize o anfitrião e todos os participantes para 2.0.1. A transmissão de imagens usa fragmentação automática e não encerra a sala por erro de tamanho. Consulte CORRECOES-2.0.1.md para a validação e limitações.
