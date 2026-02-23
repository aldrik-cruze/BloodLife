function showToast(message, type = 'success') {
  const old = document.getElementById('bl-toast');
  if (old) { clearTimeout(old._timer); old.remove(); }

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.id = 'bl-toast';
  toast.className = `bl-toast bl-toast-${type}`;
  toast.innerHTML = `
    <span class="bl-toast-icon">${icons[type] || icons.info}</span>
    <span class="bl-toast-msg">${message}</span>
    <button class="bl-toast-close" onclick="this.parentElement.remove()">×</button>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('bl-toast-show')));

  toast._timer = setTimeout(() => {
    toast.classList.remove('bl-toast-show');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}
