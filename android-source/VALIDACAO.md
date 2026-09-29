# Correção 2.0.1 — figurinhas sem desconexão

Atualize o Windows do anfitrião e todos os participantes, incluindo o APK. O anfitrião recusa clientes antigos com canal JSON e mostra uma mensagem de atualização. No PC, Ajuda → Salvar APK Android exporta o APK atualizado.

O PeerJS rejeitava mensagens JSON a partir de 16.300 bytes. Uma foto convertida em figurinha podia ultrapassar esse limite, e o tratamento de erro encerrava as conexões. A versão 2.0.1 usa transporte binário com fragmentação automática, também para listas de perfis com fotos. Erros de tamanho e congestionamento de envio não derrubam a sala.

Validação: o defeito foi reproduzido na versão anterior com uma figurinha de 24.348 bytes. Após a correção, o teste local com um anfitrião Electron e dez espectadores Chromium recebeu a imagem nos dois sentidos, manteve vídeo e chat e transmitiu uma lista de perfis de 20.212 bytes. Os IDs das conexões de dados e vídeo permaneceram iguais, sem eventos de queda/reconexão durante o teste. Os 17 testes unitários passaram.

Para repetir: no projeto Windows, execute npm run test:stickers. Requer Chrome, Electron e acesso ao servidor de sinalização PeerJS. Esse teste usa os arquivos web do projeto Android irmão.

Não foi possível testar a nova versão em aparelho Android físico nesta sessão; a validação de grupo usa Chromium com a interface móvel e os mesmos arquivos do APK. O teste local não garante desempenho em qualquer rede ou computador.

---

## Histórico da versão 2.0

# Validação — GlupStreamXD 2.0

Executada em Windows x64 com Electron 44.4.5, PeerJS 1.5.5, Chrome/Chromium e o broker público PeerJS.

## Automatizada

11 testes unitários passaram: convites, limite de 10 espectadores, recusa do 11º, encaminhamento com identidade atribuída pelo host, saída/reconexão isolada, limites de imagens, recusa de protocolo antigo, eventos de sessões antigas, timeout de 10 segundos, CRC Pix, reconexões sucessivas de sinalização e contadores WebRTC (alguns cenários estão agrupados no mesmo teste).

O teste `npm run test:desktop` abriu 1 host Electron e 10 contextos Chromium com layout Android:

- 10 espectadores + host conectados simultaneamente; 11º espectador recusado.
- Nome persistiu após recarregar a interface. Foto foi reduzida e distribuída aos participantes.
- Chat entre espectadores e host, texto HTML tratado como texto, figurinhas prontas e importação de PNG: passaram.
- Captura real da janela GlupStreamXD recebida pelos 10 espectadores.
- 10 PeerConnections de mídia e 10 de dados no host.
- Meta total configurada de 12 Mb/s; limite de vídeo aplicado a cada emissor: 956.000 b/s. Qualidade automática escolheu 480p/24 FPS para esse orçamento e quantidade.
- Contadores e 20 linhas no painel de estatísticas; 551.122 bytes enviados e 101.049 recebidos no instante do primeiro relatório. São dados transitórios do teste, não benchmark de desempenho.
- Reconexão de um espectador recuperou o vídeo sem derrubar os outros. Saída de outro reduziu a sala para 9 espectadores.
- Parada de transmissão, mudo/fullscreen web, área de entrada em viewport de teclado e saída global: passaram.
- Nenhum erro JavaScript no teste integrado.

## Pacotes

- APK 2.0 compilado, alinhado e assinatura v2/v3 verificada. Mesmo pacote e chave de desenvolvimento do APK anterior.
- Instalador Windows gerado com APK embarcado.
- Executável empacotado abriu. Botão Salvar APK exportou arquivo idêntico ao APK gerado.
- Pix copiado integralmente. Botão LivePix validado com navegador externo interceptado no teste: URL exata solicitada, sem pagamento.
- Arquivos dentro do ASAR e assets do APK comparados com o código-fonte.

## Limites

O teste de 10 espectadores ocorreu no mesmo computador/rede, com captura predominantemente estática. Não é comprovação de qualidade sustentada em 10 celulares reais, de 60 FPS/1440p nem de funcionamento entre 10 redes diferentes. NAT, TURN público, banda e hardware precisam ser considerados.

Não havia Android físico conectado. A execução do contêiner Android, seletor de fotos nativo, retorno do segundo plano e áudio audível devem ser verificados no aparelho. Os testes de mudo/fullscreen verificaram a interface Chromium. O usuário confirmou funcionamento da versão 1.0 no celular; isso não substitui o teste da versão 2.0.

O instalador foi gerado e seu conteúdo executado, sem instalação/desinstalação automática no sistema do usuário. A versão Windows não tem assinatura digital comercial; o Android usa assinatura de desenvolvimento.

## Pacotes 2.0.1

- APK compilado com versionCode 3, assinatura v2/v3 válida e mesmo certificado SHA-256 da versão 2.0.0.
- Scripts corrigidos e HTML conferidos dentro do APK e do ASAR Windows.
- Executável Windows empacotado aberto em perfil de teste: exportação do APK idêntica ao arquivo original; Pix e destino LivePix conferidos.

