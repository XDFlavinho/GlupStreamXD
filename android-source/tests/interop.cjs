// O teste de integração 2.0 está no projeto Windows e cobre 10 clientes móveis.
const path = require('node:path');
require(path.join(process.env.GLUP_WINDOWS_PROJECT || path.resolve(__dirname, '../../glupstreamxd'), 'tests/group.cjs'));
