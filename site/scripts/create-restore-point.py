"""Local source archive and consistent SQLite snapshots; never uploads data."""
from pathlib import Path
from datetime import datetime
import zipfile, sqlite3, hashlib, json

project = Path(__file__).resolve().parents[1]
destination = project.parent / 'restore-points' / datetime.now().strftime('%Y%m%d-%H%M%S-before-vr-gente')
destination.mkdir(parents=True, exist_ok=False)
excluded = {'.git','node_modules','.wrangler','dist','.next','.sites-runtime','build'}
files = []
with zipfile.ZipFile(destination / 'source.zip', 'w', zipfile.ZIP_DEFLATED, strict_timestamps=False) as archive:
    for path in project.rglob('*'):
        relative = path.relative_to(project)
        if path.is_file() and not any(p in excluded for p in relative.parts) and path.name != 'tsconfig.tsbuildinfo':
            archive.write(path, relative.as_posix())
            files.append(relative.as_posix())
databases = []
for path in (project / '.wrangler/state').rglob('*.sqlite'):
    relative = path.relative_to(project)
    target = destination / 'data' / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    source = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    backup = sqlite3.connect(target)
    source.backup(backup)
    assert backup.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    backup.close()
    source.close()
    databases.append(relative.as_posix())
with zipfile.ZipFile(destination / 'source.zip') as archive:
    assert archive.testzip() is None
manifest = {'created':datetime.now().isoformat(), 'project':str(project), 'files':len(files),'databases':databases,'source_sha256':hashlib.sha256((destination/'source.zip').read_bytes()).hexdigest()}
(destination/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(destination/'RESTORE.txt').write_text('Ponto anterior à integração VR Gente. Contém dados pessoais: mantenha local.\nPara restaurar: pare o servidor; preserve a pasta atual; extraia source.zip em uma pasta limpa; copie o conteúdo de data para a pasta restaurada preservando os caminhos; instale as dependências pelo package-lock.json e reinicie o servidor. Não sobreponha um banco em execução.\n',encoding='utf-8')
print(json.dumps({'path':str(destination),'source_files':len(files),'sqlite_snapshots':len(databases),'verified':True}))
