/** Remove apenas a origem ChatGPT dos endereços visuais, preservando demais parâmetros e âncoras. */
(() => {
  const endereco = new URL(window.location.href);
  if (endereco.searchParams.get('utm_source') !== 'chatgpt.com') return;
  endereco.searchParams.delete('utm_source');
  window.history.replaceState(
    window.history.state,
    '',
    endereco.pathname + endereco.search + endereco.hash,
  );
})();
