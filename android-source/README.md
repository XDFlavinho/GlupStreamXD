# GlupStreamXD Android 2.0.1

Cliente Android para assistir à tela de um host Windows e participar do chat com até 10 espectadores. Agora inclui nome/foto salvos, figurinhas, lista de participantes, ajuda/apoio e estatísticas.

## Instalar e conectar

1. Instale o APK 2.0.1 sobre a versão anterior. Pacote e chave de assinatura são os mesmos.
2. Atualize o Windows também para **2.0.1**. O protocolo de grupo não aceita versões 1.0.
3. No PC, crie uma sala e envie o ID. No Android, use **Entrar em Sala**.
4. O host inicia a transmissão no PC; o vídeo abre automaticamente no celular.
5. Toque no avatar no topo para salvar nome/foto; na carinha do chat para figurinhas; no gráfico para estatísticas; no ponto de interrogação para ajuda e apoio.
6. Para ouvir, o host marca **Áudio do sistema** antes da captura. Use Mudo/Ativar som no player e o volume de mídia do celular.

Requisitos: Android 8+ e Android System WebView atualizado. O APK é universal (sem bibliotecas por arquitetura de CPU), assinado para instalação direta/desenvolvimento. Não é para iPhone e não foi publicado na Play Store. No Windows, **Ajuda → Salvar APK Android** também disponibiliza o mesmo arquivo sem download externo.

O celular é espectador, não transmite sua tela. Mantenha o app visível: o sistema pode suspender conexões em segundo plano. Nome e foto ficam no armazenamento local; mensagens e figurinhas não são persistidas. Foto/figurinha são selecionadas pelo seletor do sistema, sem permissão de acesso amplo ao armazenamento, câmera ou microfone. Fotos são reduzidas para até 96 px e figurinhas para até 256 px, com limites no protocolo.

## Rede e estatísticas

O protocolo PeerJS é compartilhado com o Windows. O host distribui mensagens e envia uma cópia do vídeo por espectador. Sinalização, STUN e TURN públicos mantêm as limitações da versão anterior.

As estatísticas mostram somente payload das conexões WebRTC deste aplicativo: banda, totais amostrados, RTT, jitter, perda, codec, FPS e resolução quando disponíveis. Excluem broker, navegação LivePix, cabeçalhos IP/UDP e outros aplicativos. Não equivalem à franquia da operadora nem ao atraso do vídeo.

## Compilar

No Windows com PowerShell 7, JDK 17+, Android SDK Platform 36 e Build Tools 36.0.0:

```powershell
./build.ps1 -JavaHome 'C:\caminho\jdk-17' -SdkRoot 'C:\caminho\Android\Sdk'
```

Ou defina `JAVA_HOME`/`ANDROID_HOME`. Não é necessário Gradle. Para pastas extraídas manualmente, use `-BuildTools` e `-PlatformJar` apontando para `android.jar`.

O script usa aapt2, javac, d8, zipalign e apksigner. Resultado: `dist/GlupStreamXD-Android-2.0.1.apk`.

A chave local está em `signing/debug.keystore`, alias `androiddebugkey`, senha de desenvolvimento `android`. Preserve esse arquivo para futuras atualizações; não está no ZIP nem no controle de versão. Recompilar em outro ambiente sem a chave gera outra identidade de assinatura, exigindo desinstalação ou uso da chave original via `-KeyStore`. Para publicação de produção, substitua por um fluxo de assinatura próprio.

## Código e testes

`app/src/main/java/.../MainActivity.java` é o contêiner com WebView, seletor de imagens, fullscreen, links de convite e ponte nativa restrita. `app/src/main/assets/web` contém os mesmos módulos de interface/protocolo do Windows. A diferença de HTML é a marca `data-mobile="true"`.

O teste de integração fica no projeto Windows e abre 10 clientes móveis Chromium contra um host Electron:

```powershell
# No projeto Windows, após npm install:
npm test
npm run test:desktop
```

A partir deste projeto, `npm run test:interop` chama o mesmo teste. Defina `GLUP_WINDOWS_PROJECT` se o projeto Windows não estiver na pasta irmã `glupstreamxd`.

Consulte `VALIDACAO.md`: não houve teste desta versão em Android físico; os testes móveis usaram os mesmos assets em Chromium. Ainda precisam de verificação no aparelho: atualização/instalação, seletor de fotos, fullscreen nativo, áudio audível e retorno do segundo plano.

## Correção de figurinhas

Atualize o anfitrião e todos os participantes para 2.0.1. A transmissão de imagens usa fragmentação automática e não encerra a sala por erro de tamanho. Consulte CORRECOES-2.0.1.md para a validação e limitações.
