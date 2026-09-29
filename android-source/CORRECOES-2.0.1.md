# Correção 2.0.1 — figurinhas sem desconexão

Atualize o Windows do anfitrião e todos os participantes, incluindo o APK. O anfitrião recusa clientes antigos com canal JSON e mostra uma mensagem de atualização. No PC, Ajuda → Salvar APK Android exporta o APK atualizado.

O PeerJS rejeitava mensagens JSON a partir de 16.300 bytes. Uma foto convertida em figurinha podia ultrapassar esse limite, e o tratamento de erro encerrava as conexões. A versão 2.0.1 usa transporte binário com fragmentação automática, também para listas de perfis com fotos. Erros de tamanho e congestionamento de envio não derrubam a sala.

Validação: o defeito foi reproduzido na versão anterior com uma figurinha de 24.348 bytes. Após a correção, o teste local com um anfitrião Electron e dez espectadores Chromium recebeu a imagem nos dois sentidos, manteve vídeo e chat e transmitiu uma lista de perfis de 20.212 bytes. Os IDs das conexões de dados e vídeo permaneceram iguais, sem eventos de queda/reconexão durante o teste. Os 17 testes unitários passaram.

Para repetir: no projeto Windows, execute npm run test:stickers. Requer Chrome, Electron e acesso ao servidor de sinalização PeerJS. Esse teste usa os arquivos web do projeto Android irmão.

Não foi possível testar a nova versão em aparelho Android físico nesta sessão; a validação de grupo usa Chromium com a interface móvel e os mesmos arquivos do APK. O teste local não garante desempenho em qualquer rede ou computador.
