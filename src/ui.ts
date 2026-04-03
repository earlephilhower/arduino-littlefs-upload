// MARK: Sidebar WebviewView HTML — all UI layout and styles

export function getWebviewHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    padding: 12px 16px;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: transparent;
    margin: 0;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Action buttons */
  .btn-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 1;
    padding: 8px 10px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-family: var(--vscode-font-family);
    cursor: pointer;
    transition: opacity 0.15s;
    box-sizing: border-box;
    white-space: nowrap;
  }
  .btn:hover { opacity: 0.85; }
  .btn-upload {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .btn-build {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .icon { font-size: 14px; line-height: 1; }

  /* Drop zone */
  .drop-zone {
    border: 2px dashed var(--vscode-input-border);
    border-radius: 6px;
    padding: 12px;
    text-align: center;
    font-size: 11px;
    opacity: 0.5;
    margin-top: 4px;
    margin-bottom: 4px;
    transition: all 0.2s;
  }
  .drop-zone.active {
    border-color: var(--vscode-focusBorder);
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
  }

  /* File listing */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.7;
  }
  .section-actions { display: flex; gap: 4px; }
  .icon-btn {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    opacity: 0.6;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .icon-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
  .file-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 12px;
  }
  .file-item {
    display: flex;
    align-items: center;
    padding: 3px 4px;
    border-radius: 3px;
    gap: 6px;
  }
  .file-item:hover { background: var(--vscode-list-hoverBackground); }
  .file-icon { opacity: 0.6; font-size: 13px; flex-shrink: 0; }
  .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-size { opacity: 0.5; font-size: 11px; flex-shrink: 0; }
  .file-del {
    opacity: 0;
    background: none;
    border: none;
    color: var(--vscode-errorForeground);
    cursor: pointer;
    font-size: 13px;
    padding: 0 2px;
    flex-shrink: 0;
  }
  .file-edit {
    opacity: 0;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    padding: 0 2px;
    flex-shrink: 0;
  }
  .file-item:hover .file-del, .file-item:hover .file-edit { opacity: 0.6; }
  .file-del:hover, .file-edit:hover { opacity: 1 !important; }
  .indent { padding-left: 16px; }
  .empty-msg {
    font-size: 11px;
    opacity: 0.5;
    font-style: italic;
    padding: 8px 0;
  }
</style>
</head>
<body>
  <div class="title">LittleFS Filesystem</div>
  <button class="btn btn-upload" onclick="upload()" style="width:100%; margin-bottom:8px; padding:10px;">
    <span class="icon">&#128640;</span> Upload
  </button>
  <div class="btn-row">
    <button class="btn btn-build" onclick="build()">
      <span class="icon">&#128230;</span> Build
    </button>
    <button class="btn btn-build" onclick="clearOutput()">
      <span class="icon">&#128465;</span> Clear
    </button>
  </div>

  <div class="drop-zone" id="dropZone">
    Drop files here to add to data/
  </div>

  <div class="section-header">
    <span>data/ contents</span>
    <div class="section-actions">
      <button class="icon-btn" onclick="addFiles()" title="Add files">+</button>
      <button class="icon-btn" onclick="addFolder()" title="Add folder">&#128193;</button>
      <button class="icon-btn" onclick="refresh()" title="Refresh">&#8635;</button>
    </div>
  </div>
  <ul class="file-list" id="fileList">
    <li class="empty-msg">Loading...</li>
  </ul>

  <script>
    const vscode = acquireVsCodeApi();
    function upload() { vscode.postMessage({command: 'upload'}); }
    function build() { vscode.postMessage({command: 'build'}); }
    function clearOutput() { vscode.postMessage({command: 'clearOutput'}); }
    function refresh() { vscode.postMessage({command: 'refresh'}); }
    function addFiles() { vscode.postMessage({command: 'addFiles'}); }
    function addFolder() { vscode.postMessage({command: 'addFolder'}); }
    function deleteFile(relPath) { vscode.postMessage({command: 'deleteFile', relPath}); }
    function openFile(relPath) { vscode.postMessage({command: 'openFile', relPath}); }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // MARK: Receive file listing from extension
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'fileList') {
        const list = document.getElementById('fileList');
        if (!msg.files || msg.files.length === 0) {
          list.innerHTML = '<li class="empty-msg">No files in data/ folder</li>';
          return;
        }
        let html = '';
        for (const f of msg.files) {
          const depth = (f.relPath.match(/\\//g) || []).length;
          const indent = depth > 0 ? ' indent' : '';
          const icon = f.isDir ? '&#128193;' : '&#128196;';
          const size = f.isDir ? '' : '<span class="file-size">' + formatSize(f.size) + '</span>';
          const edit = f.isDir ? '' : '<button class="file-edit" onclick="openFile(\\'' + f.relPath.replace(/'/g, "\\\\'") + '\\')" title="Edit">&#9998;</button>';
          const del = '<button class="file-del" onclick="deleteFile(\\'' + f.relPath.replace(/'/g, "\\\\'") + '\\')" title="Delete">&#10005;</button>';
          html += '<li class="file-item' + indent + '">'
            + '<span class="file-icon">' + icon + '</span>'
            + '<span class="file-name">' + f.name + '</span>'
            + size + edit + del + '</li>';
        }
        list.innerHTML = html;
      }
    });

    // MARK: Drag and drop
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('active'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('active'); });
    dropZone.addEventListener('drop', async e => {
      e.preventDefault();
      dropZone.classList.remove('active');
      const files = [];
      for (const file of e.dataTransfer.files) {
        const data = await readFileAsBase64(file);
        files.push({ name: file.name, data });
      }
      if (files.length > 0) {
        vscode.postMessage({ command: 'dropFiles', files });
      }
    });

    function readFileAsBase64(file) {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(reader.result)));
          resolve(base64);
        };
        reader.readAsArrayBuffer(file);
      });
    }
  </script>
</body>
</html>`;
}
