export type Route = 'test' | 'profile';

export function currentRoute(): Route {
  return location.hash.startsWith('#/perfil') ? 'profile' : 'test';
}

/** Hash routing keeps the app working on GitHub Pages and from file://. */
export function mountRouter(onChange: (route: Route) => void): void {
  const apply = (): void => {
    const route = currentRoute();
    document.documentElement.dataset.view = route;
    document.querySelectorAll<HTMLElement>('[data-view]').forEach((el) => {
      if (el.tagName === 'SECTION') el.hidden = el.dataset.view !== route;
    });
    document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((a) => {
      if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    onChange(route);
  };
  window.addEventListener('hashchange', apply);
  apply();
}
