// Runs in <head> before first paint: restores the saved theme (no flash) and flags browsers
// without scroll-driven animations. Kept as a string so astro.config.mjs can hash the exact
// bytes for the Content Security Policy.
export const themeInit =
  "(function(){var d=document.documentElement;try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')d.dataset.theme=t}catch(e){}if(!(window.CSS&&CSS.supports('animation-timeline: view()')))d.classList.add('no-sda')})();";
