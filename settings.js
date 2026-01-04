const { ipcRenderer } = require('electron');

// 窗口加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  const formatSelect = document.getElementById('format-select');

  // 关闭按钮事件
  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('settings-window-close');
  });

  // 格式选择变化事件
  formatSelect.addEventListener('change', (e) => {
    const selectedFormat = e.target.value;
    ipcRenderer.send('format-selected', selectedFormat);
  });

  // 从主进程获取当前选择的格式
  ipcRenderer.on('set-selected-format', (event, format) => {
    formatSelect.value = format;
  });

  // 点击窗口外部关闭窗口
  document.addEventListener('click', (e) => {
    if (e.target === document.body) {
      ipcRenderer.send('settings-window-close');
    }
  });
});
