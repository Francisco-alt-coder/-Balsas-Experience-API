/** Remove o parâmetro de origem dos links, sem alterar os demais parâmetros ou âncoras. */
(() => {
  const endereco = new URL(window.location.href);
  if (!endereco.searchParams.has('utm_source')) return;
  endereco.searchParams.delete('utm_source');
  window.history.replaceState(
    window.history.state,
    '',
    endereco.pathname + endereco.search + endereco.hash,
  );
})();
