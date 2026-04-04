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
    min-height: 100vh;
    box-sizing: border-box;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
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
    margin-bottom: 8px;
    padding: 10px;
  }
  .btn-build {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    padding: 5px;
    font-size: 11px;
    opacity: 0.8;
  }
  .icon { font-size: 14px; line-height: 1; }
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
  .section-actions { display: flex; gap: 2px; align-items: center; }
  .icon-btn {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    opacity: 0.6;
    font-size: 15px;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 1;
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
    cursor: default;
  }
  .file-item:hover { background: var(--vscode-list-hoverBackground); }
  .file-item.drop-target {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }
  .file-item.drop-child {
    background: var(--vscode-list-hoverBackground);
    opacity: 0.85;
  }
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
  .file-item:hover .file-del { opacity: 0.6; }
  .file-del:hover { opacity: 1 !important; }
  .file-item:not([data-isdir="true"]) { cursor: pointer; }
  .section-header.drop-target {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
    border-radius: 3px;
  }
  .empty-msg {
    font-size: 11px;
    opacity: 0.5;
    font-style: italic;
    padding: 8px 0;
  }
  .drop-hint {
    font-size: 10px;
    opacity: 0.3;
    text-align: center;
    padding: 8px 0;
    position: fixed;
    bottom: 8px;
    left: 0;
    right: 0;
  }
  .ctx-menu {
    position: fixed;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    color: var(--vscode-menu-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border));
    border-radius: 4px;
    padding: 4px 0;
    min-width: 140px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: none;
  }
  .ctx-menu.show { display: block; }
  .ctx-item {
    padding: 4px 16px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .ctx-item:hover { background: var(--vscode-list-hoverBackground); }
  .ctx-sep {
    border-top: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-widget-border));
    margin: 4px 0;
  }
</style>
</head>
<body>
  <div class="title">LittleFS Filesystem</div>
  <button class="btn btn-upload" onclick="upload()">
    <span class="icon">&#128640;</span> Upload
  </button>
  <button class="btn btn-build" onclick="build()">
    <span class="icon" style="font-size:12px;">&#128230;</span> Build
  </button>

  <div class="section-header">
    <span>data/</span>
    <div class="section-actions">
      <button class="icon-btn" onclick="addFiles('')" title="Add File">&#10133;</button>
      <button class="icon-btn" onclick="addFolder('')" title="Add Folder">&#128193;</button>
      <button class="icon-btn" onclick="refresh()" title="Refresh">&#128260;</button>
    </div>
  </div>
  <ul class="file-list" id="fileList">
    <li class="empty-msg">Loading...</li>
  </ul>
  <div class="drop-hint">Drop files or folders here</div>

  <div class="ctx-menu" id="ctxMenu"></div>

  <script>
    const vscode = acquireVsCodeApi();
    function upload() { vscode.postMessage({command: 'upload'}); }
    function build() { vscode.postMessage({command: 'build'}); }
    function refresh() { vscode.postMessage({command: 'refresh'}); }
    function addFiles(targetDir) { vscode.postMessage({command: 'addFiles', targetDir: targetDir || ''}); }
    function addFolder(targetDir) { vscode.postMessage({command: 'addFolder', targetDir: targetDir || ''}); }
    function newFile(targetDir) { vscode.postMessage({command: 'newFile', targetDir: targetDir || ''}); }
    function newFolder(targetDir) { vscode.postMessage({command: 'newFolder', targetDir: targetDir || ''}); }
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
          const indentStyle = depth > 0 ? ' style="padding-left:' + (depth * 16) + 'px"' : '';
          const icon = f.isDir ? '&#128193;' : '&#128196;';
          const size = f.isDir ? '' : '<span class="file-size">' + formatSize(f.size) + '</span>';
          const esc = f.relPath.replace(/'/g, "\\\\'");
          const del = '<button class="file-del" onclick="event.stopPropagation(); deleteFile(\\'' + esc + '\\')" title="Delete">&#10005;</button>';
          html += '<li class="file-item"'
            + indentStyle
            + ' data-path="' + f.relPath.replace(/"/g, '&quot;') + '"'
            + ' data-isdir="' + f.isDir + '"'
            + (f.isDir ? ' data-dir="' + f.relPath.replace(/"/g, '&quot;') + '"' : ' onclick="openFile(\\'' + esc + '\\')'+ '"')
            + '>'
            + '<span class="file-icon">' + icon + '</span>'
            + '<span class="file-name">' + f.name + '</span>'
            + size + del + '</li>';
        }
        list.innerHTML = html;
      }
    });

    // MARK: Context menu
    const ctxMenu = document.getElementById('ctxMenu');
    document.addEventListener('click', () => ctxMenu.classList.remove('show'));

    document.addEventListener('contextmenu', e => {
      e.preventDefault();
      ctxMenu.classList.remove('show');
      const item = e.target.closest('.file-item');
      let html = '';

      if (item) {
        const isDir = item.dataset.isdir === 'true';
        const relPath = item.dataset.path;
        if (isDir) {
          html += '<div class="ctx-item" data-action="newFile" data-target="' + relPath + '">New File</div>';
          html += '<div class="ctx-item" data-action="newFolder" data-target="' + relPath + '">New Folder</div>';
          html += '<div class="ctx-sep"></div>';
        } else {
          html += '<div class="ctx-item" data-action="open" data-path="' + relPath + '">Open</div>';
        }
        html += '<div class="ctx-item" data-action="delete" data-path="' + relPath + '">Delete</div>';
      } else {
        html += '<div class="ctx-item" data-action="newFile" data-target="">New File</div>';
        html += '<div class="ctx-item" data-action="newFolder" data-target="">New Folder</div>';
      }
      html += '<div class="ctx-sep"></div>';
      html += '<div class="ctx-item" data-action="refresh">Refresh</div>';

      ctxMenu.innerHTML = html;
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top = e.clientY + 'px';
      ctxMenu.classList.add('show');
      const rect = ctxMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) ctxMenu.style.left = (window.innerWidth - rect.width - 4) + 'px';
      if (rect.bottom > window.innerHeight) ctxMenu.style.top = (window.innerHeight - rect.height - 4) + 'px';
    });

    ctxMenu.addEventListener('click', e => {
      const el = e.target.closest('.ctx-item');
      if (!el) return;
      ctxMenu.classList.remove('show');
      const action = el.dataset.action;
      if (action === 'addFiles') addFiles(el.dataset.target);
      else if (action === 'addFolder') addFolder(el.dataset.target);
      else if (action === 'newFile') newFile(el.dataset.target);
      else if (action === 'newFolder') newFolder(el.dataset.target);
      else if (action === 'delete') deleteFile(el.dataset.path);
      else if (action === 'open') openFile(el.dataset.path);
      else if (action === 'refresh') refresh();
    });

    // MARK: Drag and drop on entire sidebar
    let dropTargetDir = '';

    document.body.addEventListener('dragover', e => {
      e.preventDefault();
      document.body.classList.add('drag-over');
      document.querySelectorAll('.drop-target, .drop-child').forEach(el => el.classList.remove('drop-target', 'drop-child'));
      const item = e.target.closest('.file-item[data-dir]');
      if (item) {
        item.classList.add('drop-target');
        dropTargetDir = item.dataset.dir;
        // Highlight children of the folder
        const prefix = dropTargetDir + '/';
        document.querySelectorAll('.file-item[data-path]').forEach(el => {
          if (el.dataset.path.startsWith(prefix)) el.classList.add('drop-child');
        });
      } else {
        dropTargetDir = '';
        // Highlight section header for root drop
        const hdr = document.querySelector('.section-header');
        if (hdr) hdr.classList.add('drop-target');
      }
    });

    document.body.addEventListener('dragleave', e => {
      if (!document.body.contains(e.relatedTarget)) {
        document.body.classList.remove('drag-over');
        document.querySelectorAll('.drop-target, .drop-child').forEach(el => el.classList.remove('drop-target', 'drop-child'));
        dropTargetDir = '';
      }
    });

    document.body.addEventListener('drop', async e => {
      e.preventDefault();
      document.body.classList.remove('drag-over');
      document.querySelectorAll('.drop-target, .drop-child').forEach(el => el.classList.remove('drop-target', 'drop-child'));
      const files = [];
      const folders = [];

      async function collectEntry(entry, prefix) {
        if (entry.isFile) {
          const file = await new Promise(r => entry.file(r));
          const base64 = await new Promise(r => {
            const rd = new FileReader();
            rd.onload = () => r(rd.result.split(',')[1] || '');
            rd.readAsDataURL(file);
          });
          files.push({ name: prefix + file.name, data: base64 });
        } else if (entry.isDirectory) {
          const dir = prefix + entry.name;
          folders.push(dir);
          const children = await new Promise(r => entry.createReader().readEntries(r));
          for (const child of children) { await collectEntry(child, dir + '/'); }
        }
      }

      const items = e.dataTransfer.items;
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) { await collectEntry(entry, ''); }
      }

      if (files.length > 0 || folders.length > 0) {
        vscode.postMessage({ command: 'dropFiles', files, folders, targetDir: dropTargetDir });
      }
      dropTargetDir = '';
    });
  </script>
</body>
</html>`;
}
