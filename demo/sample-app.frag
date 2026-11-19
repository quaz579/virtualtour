<header class="app-header">
  <strong class="brand">Acme Console</strong>
  <input id="search" type="search" placeholder="Search" aria-label="Search" />
  <nav>
    <a id="nav-home" href="#home">Home</a>
    <a id="nav-reports" href="#reports">Reports</a>
    <button id="profile" type="button">Profile</button>
  </nav>
</header>
<div class="app-body">
  <aside class="app-side">
    <a id="side-inbox" href="#inbox">Inbox</a>
    <a id="side-billing" href="#billing">Billing</a>
    <a id="side-team" href="#team">Team</a>
  </aside>
  <section class="app-main">
    <div class="cards">
      <article id="card-a" class="card"><h3>Revenue</h3><p>$12,480</p></article>
      <article id="card-b" class="card"><h3>Orders</h3><p>318</p></article>
      <article id="card-c" class="card"><h3>Refunds</h3><p>7</p></article>
    </div>
    <form id="form" class="card" onsubmit="return false">
      <h3>New invoice</h3>
      <label>Customer <input id="customer" type="text" /></label>
      <button id="save" type="button">Save invoice</button>
    </form>
    <p id="footer-note" class="note">Last synced a minute ago.</p>
  </section>
</div>
