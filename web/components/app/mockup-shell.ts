// The mockup's exact static skeleton. The runtime (mockup-runtime.js) fills #scroll,
// #tabbar, #detail and #settings. Matches garmin-mockups-detail (1).html.
export const SHELL_HTML = `
<div class="stage">
  <div class="phone">
    <div class="notch"></div>
    <div class="screen" id="screen" data-mode="pulse">
      <div class="scroll" id="scroll"></div>
      <nav class="tabbar" id="tabbar"></nav>
      <div id="detail"><div class="d-inner" id="dInner"></div></div>
      <div id="settings"></div>
    </div>
  </div>
</div>`;
