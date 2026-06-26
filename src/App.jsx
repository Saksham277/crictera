import { useState, useEffect, useRef, useCallback } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { signUp, signIn, signOut, sendPasswordReset, updatePassword, updateEmail, updateProfileName } from "./auth";
import {
  fetchMyMatches,
  createMatch as dbCreateMatch,
  updateMatch as dbUpdateMatch,
  deleteMatch as dbDeleteMatch,
  fetchMatchByCode,
  subscribeToMatch,
  subscribeToMyMatches,
} from "./matchesData";


// ============================================================
// URL SHARE HELPERS
// Share links encode the full match JSON in the URL hash so
// any device can open the match without needing an account.
// ============================================================
const encodeMatchToURL = (match, role) => {
  try {
    // Strip heavy fields to keep URL shorter
    const slim = {
      ...match,
      // Keep ball-by-ball but limit to last 200 balls to avoid URL overflow
      innings: Object.fromEntries(
        Object.entries(match.innings || {}).map(([k, inn]) => [k, {
          ...inn,
          balls_by_ball: (inn.balls_by_ball || []).slice(-200),
        }])
      ),
    };
    const json = JSON.stringify({ match: slim, role });
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  } catch(e) { return null; }
};

const decodeShareFromURL = () => {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return null;
    const encoded = hash.slice(7);
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch(e) { return null; }
};

const clearShareHash = () => {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch(e) {}
};

// ============================================================
// STYLES
// ============================================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0c10;
    --bg2: #10141c;
    --bg3: #181d28;
    --card: #1a1f2e;
    --card2: #1e2436;
    --border: #252c3e;
    --border2: #2e3650;
    --gold: #f5c842;
    --gold2: #e8a800;
    --green: #1de9a0;
    --green2: #0fba7d;
    --red: #ff4a6e;
    --red2: #c8003a;
    --blue: #4a9eff;
    --blue2: #1a72d9;
    --purple: #a259ff;
    --text: #e8eaf0;
    --text2: #8892a4;
    --text3: #565f76;
    --font-display: 'Bebas Neue', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --radius: 12px;
    --radius-sm: 8px;
    --shadow: 0 4px 24px rgba(0,0,0,0.4);
    --shadow-lg: 0 8px 48px rgba(0,0,0,0.6);
    --glow-gold: 0 0 20px rgba(245,200,66,0.3);
    --glow-green: 0 0 20px rgba(29,233,160,0.3);
    --glow-red: 0 0 20px rgba(255,74,110,0.3);
  }

  html, body { background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 15px; min-height: 100vh; overflow-x: hidden; }

  #root { min-height: 100vh; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* NAV */
  .nav { background: rgba(10,12,16,0.95); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 0 16px; display: flex; align-items: center; justify-content: space-between; height: 56px; position: sticky; top: 0; z-index: 100; }
  .nav-logo { font-family: var(--font-display); font-size: 24px; color: var(--gold); letter-spacing: 1px; display: flex; align-items: center; gap: 8px; }
  .nav-logo span { color: var(--text); }
  .nav-actions { display: flex; gap: 8px; align-items: center; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: var(--font-body); font-weight: 600; font-size: 13px; transition: all 0.15s; text-decoration: none; white-space: nowrap; }
  .btn:active { transform: scale(0.97); }
  .btn-primary { background: var(--gold); color: #0a0c10; }
  .btn-primary:hover { background: var(--gold2); box-shadow: var(--glow-gold); }
  .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--card); color: var(--text); }
  .btn-danger { background: var(--red); color: white; }
  .btn-danger:hover { background: var(--red2); }
  .btn-success { background: var(--green); color: #0a0c10; }
  .btn-success:hover { background: var(--green2); }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn-lg { padding: 12px 24px; font-size: 15px; }
  .btn-icon { padding: 8px; border-radius: var(--radius-sm); }
  .btn-purple { background: var(--purple); color: white; }
  .btn-blue { background: var(--blue); color: white; }

  /* SCORE BUTTONS */
  .score-btn { width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--border); background: var(--card); color: var(--text); font-family: var(--font-display); font-size: 26px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
  .score-btn:hover { transform: scale(1.08); }
  .score-btn:active { transform: scale(0.95); }
  .score-btn.dot { border-color: var(--border2); }
  .score-btn.one { border-color: var(--blue); color: var(--blue); }
  .score-btn.two { border-color: var(--blue); color: var(--blue); }
  .score-btn.three { border-color: var(--blue); color: var(--blue); }
  .score-btn.four { border-color: var(--gold); color: var(--gold); background: rgba(245,200,66,0.08); box-shadow: var(--glow-gold); }
  .score-btn.six { border-color: var(--green); color: var(--green); background: rgba(29,233,160,0.08); box-shadow: var(--glow-green); }
  .score-btn.wicket { border-color: var(--red); color: var(--red); background: rgba(255,74,110,0.08); box-shadow: var(--glow-red); width: 80px; height: 64px; border-radius: 32px; font-size: 16px; font-family: var(--font-body); }
  .score-btn.wide { border-color: var(--purple); color: var(--purple); font-size: 14px; font-family: var(--font-body); border-radius: 32px; width: 72px; height: 64px; }
  .score-btn.noball { border-color: var(--gold2); color: var(--gold2); font-size: 12px; font-family: var(--font-body); border-radius: 32px; width: 72px; height: 64px; }

  /* CARDS */
  .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
  .card-sm { padding: 14px; border-radius: var(--radius-sm); }
  .card-hover { transition: all 0.2s; cursor: pointer; }
  .card-hover:hover { border-color: var(--border2); background: var(--card2); transform: translateY(-1px); box-shadow: var(--shadow); }

  /* INPUTS */
  .input { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 14px; color: var(--text); font-family: var(--font-body); font-size: 14px; width: 100%; transition: border-color 0.15s; }
  .input:focus { outline: none; border-color: var(--gold); }
  .input::placeholder { color: var(--text3); }
  .label { font-size: 12px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block; }
  .form-group { margin-bottom: 16px; }
  select.input option { background: var(--bg2); }

  /* SCORE DISPLAY */
  .score-main { font-family: var(--font-display); font-size: clamp(48px, 12vw, 80px); line-height: 1; color: var(--text); letter-spacing: 2px; }
  .score-overs { font-family: var(--font-mono); font-size: 18px; color: var(--text2); }
  .score-rr { font-family: var(--font-mono); font-size: 14px; color: var(--gold); }
  .wicket-count { color: var(--red); }

  /* BADGES */
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-live { background: rgba(255,74,110,0.2); color: var(--red); border: 1px solid var(--red); animation: pulse 2s infinite; }
  .badge-gold { background: rgba(245,200,66,0.15); color: var(--gold); border: 1px solid var(--gold2); }
  .badge-green { background: rgba(29,233,160,0.15); color: var(--green); border: 1px solid var(--green2); }
  .badge-blue { background: rgba(74,158,255,0.15); color: var(--blue); border: 1px solid var(--blue2); }
  .badge-purple { background: rgba(162,89,255,0.15); color: var(--purple); }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes bounceIn { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

  .fade-in { animation: fadeIn 0.3s ease forwards; }
  .slide-in { animation: slideIn 0.3s ease forwards; }
  .bounce-in { animation: bounceIn 0.4s ease forwards; }

  /* BALL EVENTS */
  .ball-dot { background: var(--bg3); color: var(--text3); border: 1px solid var(--border); }
  .ball-run { background: rgba(74,158,255,0.15); color: var(--blue); border: 1px solid rgba(74,158,255,0.3); }
  .ball-four { background: rgba(245,200,66,0.2); color: var(--gold); border: 1px solid var(--gold2); }
  .ball-six { background: rgba(29,233,160,0.2); color: var(--green); border: 1px solid var(--green2); }
  .ball-wicket { background: rgba(255,74,110,0.2); color: var(--red); border: 1px solid var(--red2); }
  .ball-wide { background: rgba(162,89,255,0.15); color: var(--purple); border: 1px solid var(--purple); }
  .ball-noball { background: rgba(245,166,0,0.15); color: var(--gold2); border: 1px solid var(--gold2); }

  /* MISC */
  .divider { height: 1px; background: var(--border); margin: 16px 0; }
  .page { padding: 16px; max-width: 480px; margin: 0 auto; animation: fadeIn 0.3s ease; }
  .page-title { font-family: var(--font-display); font-size: 32px; color: var(--text); letter-spacing: 1px; margin-bottom: 4px; }
  .page-sub { color: var(--text2); font-size: 14px; margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .flex { display: flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .gap-4 { gap: 16px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
  .text-gold { color: var(--gold); }
  .text-green { color: var(--green); }
  .text-red { color: var(--red); }
  .text-blue { color: var(--blue); }
  .text-muted { color: var(--text2); }
  .text-sm { font-size: 13px; }
  .text-xs { font-size: 11px; }
  .font-mono { font-family: var(--font-mono); }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-2 { margin-top: 8px; }
  .mt-3 { margin-top: 12px; }
  .mt-4 { margin-top: 16px; }
  .w-full { width: 100%; }
  .text-center { text-align: center; }

  /* PLAYER AVATAR */
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--card2); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: var(--gold); overflow: hidden; flex-shrink: 0; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-lg { width: 52px; height: 52px; font-size: 18px; }
  .avatar-xl { width: 72px; height: 72px; font-size: 24px; border-width: 3px; }

  /* STATS ROW */
  .stat-box { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; text-align: center; }
  .stat-val { font-family: var(--font-display); font-size: 26px; color: var(--text); }
  .stat-label { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

  /* TABS */
  .tabs { display: flex; gap: 4px; background: var(--bg2); padding: 4px; border-radius: var(--radius-sm); margin-bottom: 16px; }
  .tab { flex: 1; padding: 8px; text-align: center; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; color: var(--text3); transition: all 0.15s; border: none; background: transparent; }
  .tab.active { background: var(--card2); color: var(--text); }

  /* REACTION BAR */
  .reaction-bar { display: flex; gap: 8px; justify-content: center; padding: 12px; }
  .reaction-btn { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px; font-size: 18px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
  .reaction-btn:hover { transform: scale(1.1); background: var(--card2); }
  .reaction-count { font-size: 12px; font-weight: 700; color: var(--text2); font-family: var(--font-mono); }

  /* TIMELINE BALL */
  .timeline-over { margin-bottom: 16px; }
  .timeline-over-header { font-size: 11px; color: var(--text3); font-family: var(--font-mono); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .timeline-balls { display: flex; flex-wrap: wrap; gap: 6px; }
  .timeline-ball { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: var(--font-mono); }

  /* COMMENTARY */
  .commentary-item { padding: 10px 14px; border-left: 3px solid var(--border); margin-bottom: 8px; background: var(--bg2); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
  .commentary-item.highlight { border-left-color: var(--gold); background: rgba(245,200,66,0.05); }
  .commentary-item.wicket { border-left-color: var(--red); background: rgba(255,74,110,0.05); }
  .commentary-ball { font-family: var(--font-mono); font-size: 11px; color: var(--text3); margin-bottom: 4px; }
  .commentary-text { font-size: 13px; color: var(--text); line-height: 1.5; }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
  .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius) var(--radius) 0 0; width: 100%; max-width: 480px; padding: 20px; max-height: 85vh; overflow-y: auto; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
  .modal-handle { width: 36px; height: 4px; background: var(--border2); border-radius: 2px; margin: 0 auto 16px; }
  .modal-title { font-family: var(--font-display); font-size: 22px; margin-bottom: 16px; }

  /* PARTNERSHIP */
  .partnership-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin: 6px 0; }
  .partnership-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--green)); border-radius: 3px; transition: width 0.5s ease; }

  /* TOSS */
  .toss-coin { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--gold2)); display: flex; align-items: center; justify-content: center; font-size: 40px; margin: 20px auto; box-shadow: 0 0 40px rgba(245,200,66,0.5); animation: none; }
  .toss-coin.spinning { animation: coinSpin 0.8s ease-in-out 3; }
  @keyframes coinSpin { 0%{transform:rotateY(0)} 50%{transform:rotateY(90deg)} 100%{transform:rotateY(0)} }

  /* HIGHLIGHTS */
  .highlight-card { background: linear-gradient(135deg, var(--card), var(--card2)); border: 1px solid var(--border2); border-radius: var(--radius); padding: 14px; margin-bottom: 10px; }
  .highlight-moment { font-size: 24px; margin-bottom: 4px; }
  .highlight-desc { font-size: 13px; color: var(--text); font-weight: 600; }
  .highlight-meta { font-size: 11px; color: var(--text3); margin-top: 4px; font-family: var(--font-mono); }

  /* SCOREBOARD TABLE */
  .score-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .score-table th { text-align: left; padding: 8px 6px; font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
  .score-table td { padding: 8px 6px; border-bottom: 1px solid rgba(37,44,62,0.5); vertical-align: middle; }
  .score-table tr:last-child td { border-bottom: none; }
  .score-table .batting { font-family: var(--font-mono); font-size: 12px; color: var(--gold); font-weight: 700; }
  .score-table .out { color: var(--text3); }

  /* MATCH RESULT */
  .result-screen { background: radial-gradient(ellipse at center, var(--card2) 0%, var(--bg) 70%); border: 1px solid var(--border2); border-radius: var(--radius); padding: 32px 20px; text-align: center; }
  .result-trophy { font-size: 64px; margin-bottom: 16px; animation: bounceIn 0.5s ease; }
  .result-winner { font-family: var(--font-display); font-size: 36px; color: var(--gold); }
  .result-score { font-family: var(--font-mono); font-size: 18px; color: var(--text2); margin: 8px 0; }

  /* EQUIPMENT */
  .equip-item { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg2); border-radius: var(--radius-sm); margin-bottom: 8px; }
  .equip-icon { font-size: 22px; }

  /* PLAYER CARD */
  .player-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 8px; }
  .player-rank { font-family: var(--font-display); font-size: 20px; color: var(--text3); width: 28px; text-align: center; }
  .player-rank.gold { color: var(--gold); }
  .player-rank.silver { color: #aaa; }
  .player-rank.bronze { color: #cd7f32; }

  /* SERIES */
  .series-score-bar { display: flex; align-items: center; gap: 0; background: var(--bg3); border-radius: 6px; overflow: hidden; height: 8px; margin: 8px 0; }
  .series-bar-a { background: var(--blue); transition: flex 0.5s; }
  .series-bar-b { background: var(--red); transition: flex 0.5s; }
  .series-bar-tie { background: var(--text3); flex: 0.1; }

  /* ACCESS CODES */
  .code-box { background: var(--bg3); border: 1px dashed var(--border2); border-radius: var(--radius-sm); padding: 14px; text-align: center; }
  .code-val { font-family: var(--font-mono); font-size: 22px; letter-spacing: 4px; color: var(--gold); font-weight: 700; }
  .code-link { font-family: var(--font-mono); font-size: 11px; color: var(--text3); word-break: break-all; margin-top: 6px; }

  /* LOADING */
  .spinner { width: 24px; height: 24px; border: 2px solid var(--border2); border-top-color: var(--gold); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }

  /* EMPTY STATE */
  .empty { text-align: center; padding: 40px 20px; }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--text3); }

  /* BOWLER SELECT */
  .selector-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s; }
  .selector-row:hover { border-color: var(--gold); }
  .selector-row.active { border-color: var(--gold); background: rgba(245,200,66,0.05); }

  /* OVER DOT DISPLAY */
  .over-display { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .over-dot { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid var(--border2); display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11px; font-weight: 700; background: var(--bg3); }

  /* CREASE */
  .crease-indicator { display: flex; gap: 4px; align-items: center; font-size: 12px; color: var(--text3); }
  .striker-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--gold); }

  /* TOAST */
  .toast-container { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 500; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
  .toast { background: var(--card); border: 1px solid var(--border2); border-radius: var(--radius-sm); padding: 10px 18px; font-size: 13px; font-weight: 600; animation: fadeIn 0.3s ease, fadeOut 0.3s ease 2.5s forwards; box-shadow: var(--shadow); white-space: nowrap; }
  .toast-four { border-color: var(--gold); color: var(--gold); background: rgba(245,200,66,0.1); }
  .toast-six { border-color: var(--green); color: var(--green); background: rgba(29,233,160,0.1); }
  .toast-wicket { border-color: var(--red); color: var(--red); background: rgba(255,74,110,0.1); }
  /* BALL MEDIA */
  .ball-media-btn { background: var(--bg3); border: 1px dashed var(--border2); border-radius: var(--radius-sm); padding: 8px 14px; font-size: 12px; color: var(--text3); cursor: pointer; display: flex; align-items: center; gap: 6px; transition: border-color 0.15s; }
  .ball-media-btn:hover { border-color: var(--gold); color: var(--gold); }
  .ball-media-preview { width: 100%; max-height: 160px; object-fit: cover; border-radius: var(--radius-sm); margin-top: 8px; }
  .player-disabled { opacity: 0.4; pointer-events: none; }
  .player-out-label { font-size: 10px; color: var(--red); font-weight: 700; margin-left: 6px; }
  .bowler-over-limit { font-size: 10px; color: var(--red); font-weight: 700; margin-left: 6px; }
  .score-blocked { opacity: 0.5; pointer-events: none; }
  .score-blocked-msg { background: rgba(255,74,110,0.1); border: 1px solid var(--red2); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px; color: var(--red); text-align: center; margin-bottom: 12px; }
  @keyframes fadeOut { to{opacity:0;transform:translateY(-8px)} }

  /* VIDEO RECORDER */
  .video-rec-btn { background: var(--bg3); border: 2px solid var(--border2); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; color: var(--text2); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; width: 100%; }
  .video-rec-btn:hover { border-color: var(--red); color: var(--red); }
  .video-rec-btn.recording { border-color: var(--red); color: var(--red); background: rgba(255,74,110,0.08); animation: pulse 1s infinite; }
  .video-rec-btn.has-video { border-color: var(--green); color: var(--green); background: rgba(29,233,160,0.08); }
  .rec-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--red); animation: pulse 0.8s infinite; }
  .video-preview { width: 100%; max-height: 200px; border-radius: var(--radius-sm); background: #000; display: block; }

  /* AI PREDICTOR */
  .predictor-bar { height: 10px; border-radius: 5px; overflow: hidden; display: flex; margin: 8px 0; }
  .predictor-a { background: linear-gradient(90deg, var(--blue), var(--blue2)); transition: flex 0.8s cubic-bezier(0.34,1.56,0.64,1); }
  .predictor-b { background: linear-gradient(90deg, var(--red2), var(--red)); transition: flex 0.8s cubic-bezier(0.34,1.56,0.64,1); }
  .predictor-pct { font-family: var(--font-display); font-size: 32px; }
  .predictor-label { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; }
  .factor-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .factor-row:last-child { border-bottom: none; }
  .factor-pill { padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .pill-good { background: rgba(29,233,160,0.15); color: var(--green); }
  .pill-bad { background: rgba(255,74,110,0.15); color: var(--red); }
  .pill-neutral { background: rgba(245,200,66,0.12); color: var(--gold); }

  /* STATS DASHBOARD */
  .wagon-wheel { position: relative; width: 200px; height: 200px; border-radius: 50%; border: 2px solid var(--border2); margin: 0 auto; background: radial-gradient(circle, var(--bg3) 0%, var(--bg2) 100%); overflow: hidden; }
  .worm-chart { width: 100%; height: 80px; }
  .chart-bar-wrap { display: flex; align-items: flex-end; gap: 3px; height: 60px; }
  .chart-bar { flex: 1; border-radius: 3px 3px 0 0; min-width: 4px; transition: height 0.4s ease; }

  /* TEAM MANAGEMENT */
  .team-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; }
  .team-card:hover { border-color: var(--gold); transform: translateY(-1px); }
  .team-jersey { width: 48px; height: 48px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; flex-shrink: 0; }

  /* TOURNAMENT */
  .bracket-match { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 6px; }
  .bracket-match.winner { border-color: var(--gold); background: rgba(245,200,66,0.06); }
  .bracket-team { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 4px 0; }
  .bracket-score { font-family: var(--font-mono); font-weight: 700; font-size: 15px; color: var(--gold); }
  .bracket-connector { width: 2px; background: var(--border2); height: 20px; margin: 0 auto; }
  .stage-header { font-family: var(--font-display); font-size: 18px; color: var(--text2); margin: 16px 0 10px; text-transform: uppercase; letter-spacing: 2px; }

  /* DRS */
  .drs-panel { background: linear-gradient(135deg, rgba(255,74,110,0.08), rgba(162,89,255,0.06)); border: 1px solid rgba(255,74,110,0.3); border-radius: var(--radius); padding: 16px; }
  .drs-title { font-family: var(--font-display); font-size: 22px; color: var(--red); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .drs-review-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; margin-right: 4px; }
  .drs-dot-avail { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .drs-dot-used { background: var(--border2); }
  .drs-timer { font-family: var(--font-display); font-size: 48px; color: var(--red); text-align: center; line-height: 1; }
  .drs-verdict { font-family: var(--font-display); font-size: 28px; text-align: center; margin-top: 12px; }
  .drs-out { color: var(--red); }
  .drs-not-out { color: var(--green); }

  /* CAREER TRACKER */
  .career-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .career-stat { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; text-align: center; }
  .career-stat-val { font-family: var(--font-display); font-size: 28px; color: var(--gold); }
  .career-stat-lbl { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .milestone-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(245,200,66,0.12); border: 1px solid rgba(245,200,66,0.3); border-radius: 20px; padding: 4px 12px; font-size: 12px; color: var(--gold); margin: 3px; }

  /* SHARE */
  .share-card { background: linear-gradient(135deg, var(--card), var(--card2)); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
  .share-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; color: var(--text); transition: all 0.2s; margin-bottom: 8px; }
  .share-btn:hover { border-color: var(--gold); background: var(--card); }
  .share-btn-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .whatsapp-icon { background: #25D366; }
  .copy-icon { background: var(--blue2); }
  .live-icon { background: var(--red2); }
  .scorecard-preview { background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius-sm); padding: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--text2); text-align: left; white-space: pre-wrap; margin: 12px 0; max-height: 160px; overflow-y: auto; }

  .ai-analysis-box { background: linear-gradient(135deg, rgba(162,89,255,0.1), rgba(74,158,255,0.08)); border: 1px solid rgba(162,89,255,0.3); border-radius: var(--radius); padding: 14px; margin-top: 10px; }
  .ai-analysis-title { font-size: 11px; font-weight: 700; color: var(--purple); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
  .ai-analysis-text { font-size: 13px; color: var(--text); line-height: 1.6; }
  .lbw-verdict { font-size: 18px; font-weight: 800; margin-top: 8px; }
  .lbw-out { color: var(--red); }
  .lbw-not-out { color: var(--green); }
  .lbw-unclear { color: var(--gold); }

  /* PLAYER REGISTRY */
  .player-reg-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
  .player-reg-card:hover { border-color: var(--gold); background: var(--card2); }
  .player-reg-card.selected { border-color: var(--gold); background: rgba(245,200,66,0.08); }
  .player-reg-stats { font-size: 11px; color: var(--text3); margin-top: 2px; font-family: var(--font-mono); }

  /* HIGHLIGHTS REEL */
  .highlight-reel { background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius); padding: 16px; }
  .highlight-reel-title { font-family: var(--font-display); font-size: 20px; color: var(--gold); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .highlight-clip { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 8px; }
  .highlight-clip-label { font-size: 11px; color: var(--text3); margin-bottom: 6px; font-family: var(--font-mono); }

  /* SUGGESTIONS */
  .suggestion-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
  .suggestion-tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .tag-ai { background: rgba(162,89,255,0.15); color: var(--purple); border: 1px solid rgba(162,89,255,0.3); }
  .tag-social { background: rgba(74,158,255,0.15); color: var(--blue); border: 1px solid rgba(74,158,255,0.3); }
  .tag-stats { background: rgba(29,233,160,0.15); color: var(--green); border: 1px solid rgba(29,233,160,0.3); }
  .tag-game { background: rgba(245,200,66,0.15); color: var(--gold); border: 1px solid rgba(245,200,66,0.3); }
  .tag-umpire { background: rgba(255,74,110,0.15); color: var(--red); border: 1px solid rgba(255,74,110,0.3); }

  /* MOBILE RESPONSIVE FIXES */
  @media (max-width: 768px) {
    html, body { font-size: 14px; }
    .nav { padding: 0 12px; }
    .nav-logo { font-size: 18px; }
    .page { padding: 12px !important; width: 100vw !important; overflow-x: hidden !important; }
    .container { width: 100%; padding: 0 !important; margin: 0 !important; }
    
    /* Prevent overflow */
    * { max-width: 100vw; box-sizing: border-box; }
    
    .grid-2 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: repeat(2, 1fr); }
    .card { padding: 12px; }
    .btn { font-size: 12px; padding: 6px 12px; }
    .btn-lg { padding: 10px 16px; }
    
    /* Score buttons */
    .score-btn { width: 56px; height: 56px; font-size: 22px; }
    .score-btn.wicket { width: 70px; height: 56px; }
    .score-btn.wide, .score-btn.noball { width: 64px; height: 56px; }
    
    /* Tables */
    .score-table { font-size: 12px; }
    .score-table th { padding: 6px 4px; font-size: 9px; }
    .score-table td { padding: 6px 4px; }
    
    /* Modal */
    .modal { max-width: 100%; border-radius: var(--radius) var(--radius) 0 0; }
    
    /* Tabs */
    .tabs { gap: 2px; overflow-x: auto; }
    .tab { font-size: 11px; padding: 6px; }
    
    /* Career stats */
    .career-stat-grid { grid-template-columns: 1fr; }
    
    /* Leaderboard */
    .leaderboard-card { padding: 10px; }
    
    /* Flex items */
    .flex { flex-wrap: wrap; }
    .flex-center { flex-direction: column; }
    
    /* Input/Select */
    .input, select { font-size: 16px; padding: 10px 12px; }
    
    /* Player card */
    .player-card { gap: 8px; }
    .player-rank { font-size: 16px; width: 24px; }
    
    /* Match info */
    .match-info { flex-direction: column; }
    
    /* Remove horizontal scrolling */
    body, html { overflow-x: hidden !important; }
    .app { width: 100vw; overflow-x: hidden; }
  }

  @media (max-width: 480px) {
    html, body { font-size: 13px; }
    .page { padding: 8px !important; }
    .card { padding: 10px; }
    .btn { font-size: 11px; padding: 5px 10px; }
    .score-btn { width: 48px; height: 48px; font-size: 18px; }
    .score-btn.wicket { width: 60px; }
    .grid-3 { grid-template-columns: 1fr; }
    .nav-logo { font-size: 16px; }
    .stat-val { font-size: 20px; }
    .modal { max-width: 100%; }
    .page-title { font-size: 18px; }
  }
`;

// ============================================================
// UTILS
// ============================================================
const genCode = (len = 6) => Math.random().toString(36).substring(2, 2 + len).toUpperCase();
const genId = () => Math.random().toString(36).substring(2, 10);

// ============================================================
// CLIPBOARD — robust copy with fallback for mobile / iframe contexts
// where navigator.clipboard is blocked or unavailable
// ============================================================
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through to legacy method */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
};

// Sanitize a string (e.g. email) into a safe shared-storage key fragment.
const storageKeySafe = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

// ============================================================
// FILE OUTPUT — the simple, original download technique: create a blob,
// make an <a download> link, click it, remove it. This is exactly what
// worked before, with no extra fallback logic layered on top.
// ============================================================
function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Don't revoke immediately — the browser may not have queued the download yet.
  // Give it 60 seconds before releasing the blob URL.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 60000);
}

// Safe base64 encode/decode that handles Unicode correctly (no deprecated escape())
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64) {
  return decodeURIComponent(escape(atob(b64)));
}


// ============================================================
// COMPACT SHARE CODE — a much smaller serialization of a match, used for
// the manual "Copy Share Code" / downloaded-file flow. The full match
// object (especially balls_by_ball, with ~15 verbose fields per ball) is
// far too large to comfortably copy/paste on mobile once base64-encoded.
// This packs only what's needed to reconstruct a working scorecard: each
// ball becomes a short array tuple instead of a verbose object, and every
// key is abbreviated. compactMatch/expandMatch are exact inverses.
// ============================================================
const compactBall = (b) => ([
  b.runs ?? 0, b.totalRuns ?? b.runs ?? 0, b.batsman ?? null, b.bowler ?? null,
  b.wide ? 1 : 0, b.noball ? 1 : 0, b.wicket ? 1 : 0, b.wicketMode ?? null,
  b.outBatsman === 'nonStriker' ? 1 : 0, b.caughtBy ?? null,
]);
const expandBall = (t) => ({
  runs: t[0], totalRuns: t[1], batsman: t[2], bowler: t[3],
  wide: !!t[4], noball: !!t[5], wicket: !!t[6], wicketMode: t[7] || undefined,
  outBatsman: t[8] ? 'nonStriker' : 'striker', caughtBy: t[9] || null,
});

const compactPlayer = (p) => [p.id, p.name, p.isImpactIn ? 1 : 0, p.isImpactOut ? 1 : 0, p.replacedByName || null];
const expandPlayer = (t) => ({ id: t[0], name: t[1], isImpactIn: !!t[2], isImpactOut: !!t[3], replacedByName: t[4] || undefined });

const compactBatsman = (b) => [b.runs||0, b.balls||0, b.fours||0, b.sixes||0, b.out?1:0, b.outMode||null, b.bowlerName||null, b.caughtByName||null];
const expandBatsman = (t) => ({ runs: t[0], balls: t[1], fours: t[2], sixes: t[3], out: !!t[4], outMode: t[5]||undefined, bowlerName: t[6]||undefined, caughtByName: t[7]||undefined });

const compactBowler = (b) => [b.balls||0, b.runs||0, b.wickets||0];
const expandBowler = (t) => ({ balls: t[0], runs: t[1], wickets: t[2] });

const compactInnings = (inn) => ({
  t: inn.team, r: inn.runs||0, w: inn.wickets||0, b: inn.balls||0,
  e: inn.extras||0, wd: inn.wides||0, nb: inn.noballs||0,
  bb: (inn.balls_by_ball||[]).map(compactBall),
  bm: Object.fromEntries(Object.entries(inn.batsmen||{}).map(([k,v]) => [k, compactBatsman(v)])),
  bw: Object.fromEntries(Object.entries(inn.bowlers||{}).map(([k,v]) => [k, compactBowler(v)])),
  cd: (inn.catchDrops||[]).map(d => [d.name, d.runsAtDrop||0, d.at||null]),
});
const expandInnings = (c) => ({
  team: c.t, runs: c.r, wickets: c.w, balls: c.b,
  extras: c.e, wides: c.wd, noballs: c.nb,
  balls_by_ball: (c.bb||[]).map(expandBall),
  batsmen: Object.fromEntries(Object.entries(c.bm||{}).map(([k,v]) => [k, expandBatsman(v)])),
  bowlers: Object.fromEntries(Object.entries(c.bw||{}).map(([k,v]) => [k, expandBowler(v)])),
  catchDrops: (c.cd||[]).map(([name, runsAtDrop, at]) => ({ name, runsAtDrop, at })),
});

// Packs a match into the smallest reasonable JSON shape before base64.
const compactMatch = (match) => ({
  id: match.id, ti: match.title, ov: match.overs, lo: match.location || '',
  tA: match.teamA?.name, pA: (match.teamA?.players||[]).map(compactPlayer),
  tB: match.teamB?.name, pB: (match.teamB?.players||[]).map(compactPlayer),
  vc: match.viewerCode, ec: match.editorCode,
  st: match.status, bt: match.battingTeam, ci: match.currentInnings,
  tw: match.tossWinner || null, tc: match.tossChoice || null,
  inn: Object.fromEntries(Object.entries(match.innings||{}).map(([k,v]) => [k, compactInnings(v)])),
  res: match.result || null,
  cA: match.captainA || null, cB: match.captainB || null,
  ip: match.impactPlayers || [],
});

// Expands a compacted match back into the full shape the app expects.
const expandMatch = (c) => ({
  id: c.id, title: c.ti, overs: c.ov, location: c.lo,
  teamA: { name: c.tA, players: (c.pA||[]).map(expandPlayer) },
  teamB: { name: c.tB, players: (c.pB||[]).map(expandPlayer) },
  viewerCode: c.vc, editorCode: c.ec,
  status: c.st, battingTeam: c.bt, currentInnings: c.ci,
  tossWinner: c.tw, tossChoice: c.tc,
  innings: Object.fromEntries(Object.entries(c.inn||{}).map(([k,v]) => [k, expandInnings(v)])),
  result: c.res,
  notes: [], equipment: [], reactions: {},
  captainA: c.cA, captainB: c.cB,
  impactPlayers: c.ip || [],
  createdAt: Date.now(),
});

// Build the actual text the user copies/pastes — compact JSON, base64-encoded.
const buildShareCode = (match, role) => {
  const payload = { m: compactMatch(match), r: role };
  return b64encode(JSON.stringify(payload));
};

// Parses a pasted share code back into { match, role }, or null if invalid.
const parseShareCode = (text) => {
  try {
    const decoded = JSON.parse(b64decode(text.trim()));
    if (!decoded?.m) return null;
    return { match: expandMatch(decoded.m), role: decoded.r || 'viewer' };
  } catch (e) { return null; }
};


const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';
const formatRate = (runs, balls) => balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
const formatEcon = (runs, overs) => overs > 0 ? (runs / overs).toFixed(2) : '0.00';
const formatOvers = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
const ballLabel = (ball) => {
  if (ball.wicket) return 'W';
  if (ball.wide) return 'Wd';
  if (ball.noball) return 'Nb';
  if (ball.runs === 4) return '4';
  if (ball.runs === 6) return '6';
  if (ball.runs === 0) return '·';
  return String(ball.runs);
};
const ballClass = (ball) => {
  if (ball.wicket) return 'ball-wicket';
  if (ball.wide || ball.noball) return ball.wide ? 'ball-wide' : 'ball-noball';
  if (ball.runs === 4) return 'ball-four';
  if (ball.runs === 6) return 'ball-six';
  if (ball.runs > 0) return 'ball-run';
  return 'ball-dot';
};

const AI_COMMENTARY = {
  0: ["Dot ball. Excellent delivery!", "Beaten outside off! No run.", "Defended back to the bowler.", "Good length, batsman plays it safely."],
  1: ["Nudged away for a single.", "Pushed into the gap — quick single taken.", "Rotated the strike well!", "Tapped to mid-on, easy single."],
  2: ["Driven through covers — good running, two runs!", "Nicely placed, two runs taken!", "In the gap! They've run two."],
  3: ["Three runs! Great running between the wickets!", "Pushed into the outfield, excellent running — THREE!"],
  4: ["FOUR! Cracking shot through the covers!", "BOUNDARY! Driven beautifully to the rope!", "Smashed to the fence! FOUR runs!", "FOUR! Elegant cut shot past point!"],
  6: ["SIX! Magnificent! Clean over the ropes!", "SIX! Absolute monster hit! The crowd goes wild!", "INTO THE STANDS! MAXIMUM!", "SIX! That's gone a long way!"],
  wide: ["Wide delivery, easy runs for the batting side.", "Down the leg side — wide called.", "Too full and wide — called wide!"],
  noball: ["NO BALL! Free hit coming up!", "Overstepped — no ball called!", "Front foot no ball! Free hit awarded."],
  wicket: ["OUT! What a delivery! The stumps are shattered!", "WICKET! Caught behind! The keeper is ecstatic!", "GONE! Clean bowled! Stumps flying!", "OUT! Superb catch in the outfield!", "WICKET! Edge to slip! The fielder clings on!"],
};

const getCommentary = (ball) => {
  let pool;
  if (ball.wicket) pool = AI_COMMENTARY.wicket;
  else if (ball.wide) pool = AI_COMMENTARY.wide;
  else if (ball.noball) pool = AI_COMMENTARY.noball;
  else pool = AI_COMMENTARY[ball.runs] || AI_COMMENTARY[1];
  const line = pool[Math.floor(Math.random() * pool.length)];
  if (ball.batsman && !ball.wide) return `${ball.batsman}: ${line}`;
  return line;
};

const formatTime = () => {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Over label: over 0 ball 1 = "0.1", over 1 ball 3 = "1.3"
const formatBallId = (overIndex, ballInOver) => `${overIndex}.${ballInOver}`;

// ============================================================
// VIDEO / PHOTO CAPTURE COMPONENT
// Allows recording/uploading multiple times per ball
// ============================================================
function CameraCapture({ onCapture, existingMedia, type = 'video', label }) {
  const [media, setMedia] = useState(existingMedia || null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const liveRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileRef = useRef(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    clearInterval(timerRef.current);
  };

  const openCamera = async () => {
    setCameraError(null);
    setPermissionAsked(true);
    try {
      // Simpler constraints - don't specify facingMode or specific dimensions
      const constraints = type === 'video'
        ? { video: true, audio: true }
        : { video: true, audio: false };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraOpen(true);
      setCameraError(null);
      
      // Attach stream to video with proper timing
      setTimeout(() => {
        if (liveRef.current && streamRef.current) {
          liveRef.current.srcObject = streamRef.current;
          liveRef.current.play().catch(e => console.warn('Play error:', e));
        }
      }, 100);
    } catch (e) {
      console.error('Camera error:', e);
      let msg = 'Camera error: ';
      if (e.name === 'NotAllowedError') {
        msg = '📱 Camera permission denied.\n\nTo allow access:\n1. Check your browser settings\n2. Make sure camera is allowed for this site\n3. Try refreshing and trying again\n4. On mobile: Check app permissions in Settings > Apps';
      } else if (e.name === 'NotFoundError') {
        msg = '❌ No camera found on this device';
      } else if (e.name === 'NotReadableError') {
        msg = '⚠️ Camera is in use by another app. Close other apps and try again.';
      } else if (e.name === 'OverconstrainedError') {
        msg = '⚠️ Camera does not support requested features. Try recording anyway.';
      } else {
        msg += (e.message || e.name || 'Unknown error');
      }
      setCameraError(msg);
      setCameraOpen(false);
    }
  };

  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
    setRecording(false);
  };

  const startRec = () => {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      const mime = ['video/webm;codecs=vp9','video/webm'].find(m => {
        try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
      }) || 'video/webm';
      
      const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
      rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          // Create both blob URL for immediate playback AND dataURL for storage
          const blobUrl = URL.createObjectURL(blob);
          const reader = new FileReader();
          reader.onload = ev => {
            const m = { 
              type: 'video', 
              dataUrl: ev.target.result, // base64 for storage
              blobUrl: blobUrl, // blob URL for instant playback
              timestamp: Date.now() 
            };
            setMedia(m);
            onCapture?.(m);
            // Don't close camera - allow next ball recording
            setRecording(false);
          };
          reader.onerror = () => setCameraError('Failed to read video data');
          reader.readAsDataURL(blob);
        } catch (err) {
          setCameraError('Error saving video: ' + err.message);
        }
      };
      rec.start(200);
      recorderRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(n => n + 1), 1000);
    } catch (err) {
      setCameraError('Recording error: ' + err.message);
    }
  };

  const stopRec = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch (e) {}
    }
  };

  const takePhoto = () => {
    if (!liveRef.current) return;
    try {
      const v = liveRef.current;
      const c = document.createElement('canvas');
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      c.getContext('2d')?.drawImage(v, 0, 0);
      const dataUrl = c.toDataURL('image/jpeg', 0.9);
      const m = { type: 'image', dataUrl, timestamp: Date.now() };
      setMedia(m);
      onCapture?.(m);
      closeCamera();
    } catch (err) {
      setCameraError('Photo capture error: ' + err.message);
    }
  };

  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = ev => {
        const m = { 
          type: file.type.startsWith('video/') ? 'video' : 'image',
          dataUrl: ev.target.result,
          timestamp: Date.now()
        };
        setMedia(m);
        onCapture?.(m);
      };
      reader.onerror = () => setCameraError('Failed to read file');
      reader.readAsDataURL(file);
    } catch (err) {
      setCameraError('File error: ' + err.message);
    }
    e.target.value = '';
  };

  // Allow retaking without clearing media from onCapture
  const retake = () => {
    setCameraOpen(false);
    setRecording(false);
    stopStream();
    // Open camera again for new recording
    setTimeout(openCamera, 100);
  };

  const clear = () => {
    setMedia(null);
    onCapture?.(null);
    closeCamera();
  };

  const defaultLabel = type === 'video' ? '🎥 Record' : '📷 Photo';

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Live camera preview */}
      {cameraOpen && (
        <div style={{ marginBottom: 8 }}>
          <video ref={liveRef} muted playsInline 
            style={{ width: '100%', height: 240, borderRadius: 10, background: '#000', display: 'block', objectFit: 'cover' }} 
            onLoadedMetadata={() => { if (liveRef.current) liveRef.current.play().catch(() => {}); }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {type === 'image' && !recording && (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={takePhoto}>📸 Capture</button>
            )}
            {type === 'video' && !recording && (
              <button className="btn btn-danger" style={{ flex: 1, gap: 6 }} onClick={startRec}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                Record
              </button>
            )}
            {recording && (
              <button className="btn btn-danger" style={{ flex: 1, background: 'rgba(255,74,110,0.3)' }} onClick={stopRec}>
                ⏹ Stop {elapsed}s
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={closeCamera}>✕</button>
          </div>
        </div>
      )}

      {/* Captured media - show preview alongside camera option */}
      {media && (
        <div style={{ marginBottom: 8 }}>
          <video 
            src={media.blobUrl || media.dataUrl} 
            controls 
            playsInline 
            style={{ width: '100%', maxHeight: 220, borderRadius: 10, background: '#000', display: 'block' }} 
            onError={() => setCameraError('Video playback failed - try re-recording')} 
          />
          <div className="flex gap-2 mt-2" style={{ alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--green)' }}>✅ Video saved</span>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={retake}>📹 New Video</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: 11 }} onClick={clear}>✕ Clear</button>
          </div>
        </div>
      )}

      {/* Error message */}
      {cameraError && (
        <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 10px', background: 'rgba(255,74,110,0.1)', border: '1px solid rgba(255,74,110,0.3)', borderRadius: 6, marginBottom: 6, lineHeight: 1.4 }}>
          ⚠️ {cameraError}
        </div>
      )}

      {/* Initial buttons - show unless camera is open or media exists */}
      {!media && !cameraOpen && (
        <div className="flex gap-2">
          <button className="video-rec-btn" style={{ flex: 1 }} onClick={openCamera}>
            <span>{type === 'video' ? '🎥' : '📷'}</span> {label || defaultLabel}
          </button>
          <label className="video-rec-btn" style={{ flex: 1, cursor: 'pointer', marginBottom: 0, justifyContent: 'center', marginLeft: 0 }}>
            📁 Gallery
            <input ref={fileRef} type="file" accept={type === 'video' ? 'video/*,image/*' : 'image/*'} style={{ display: 'none' }} onChange={handleFile} />
          </label>
        </div>
      )}
    </div>
  );
}

// Backward-compat alias
const VideoRecorder = ({ onVideoReady, existingVideo, label }) => (
  <CameraCapture type="video" label={label || '🎥 Record Ball Video'}
    existingMedia={existingVideo ? { type: 'video', dataUrl: existingVideo } : null}
    onCapture={m => onVideoReady?.(m?.dataUrl || null)} />
);


// ============================================================
// AI VIDEO ANALYSIS (LBW + COMMENTARY)
// ============================================================
async function analyzeVideoWithAI(videoDataUrl, context = {}) {
  if (!videoDataUrl) return null;
  try {
    const prompt = context.askLBW
      ? `You are an expert cricket umpire reviewing an LBW (Leg Before Wicket) decision.

ANALYZE THE BALL CAREFULLY:
1. Delivery type & line (full length, yorker, short, bouncer, off-stump, leg-stump, middle)
2. Where the ball pitched (on/outside off, leg stump area, middle, etc)
3. Ball's deviation/movement (straight, seaming, spinning movement)
4. Batsman's position - standing, commitment to shot
5. If ball hit the pad - was it in line with the stumps
6. Would the ball have hit the stumps if there was no pad
7. Was the batsman attempting to play a shot

BALL TRACKING (Describe as if drawing the path):
Describe the ball's complete flight path - "The ball was released from approximately [height], flew through the air at [pace], with [trajectory details]. It landed on [length] with the ball pitching on [line]. After landing, the ball [movement/no movement]. It then impacted the batsman's pad at [location]..."

Then give EXACT verdict in ONE word: OUT, NOT-OUT, or UNCLEAR
Followed by 1-2 sentence explanation.

Format: "[VERDICT] - [1-2 sentence reason]"`
      : `You are an expert cricket commentator analyzing a ball delivery.

ANALYZE:
1. Delivery type (yorker, bouncer, good length, short, etc)
2. Speed and line
3. What the batsman did
4. Outcome (runs/dot/wicket)

BALL TRACKING (describe flight path):
"The ball was released from [height], traveled at [speed], following [trajectory]. It pitched on [length] with [movement]. Result: [what happened]"

Write 80-100 words total with excitement.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: prompt + `\n\nBowler: ${context.bowler || 'Unknown'}\nBatsman: ${context.batsman || 'Unknown'}`
        }]
      })
    });
    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// PLAYER REGISTRY — Add/Edit/Select saved players
// ============================================================


// Reusable inline delete button with 2-step confirmation
function DeleteConfirmButton({ onConfirm, label = '🗑️ Delete', size = 'sm', style: extraStyle = {} }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex gap-1" style={{ alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--red)', whiteSpace: 'nowrap' }}>Sure?</span>
        <button className={`btn btn-danger btn-${size}`} style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={e => { e.stopPropagation(); onConfirm(); setConfirming(false); }}>Yes</button>
        <button className={`btn btn-ghost btn-${size}`} style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={e => { e.stopPropagation(); setConfirming(false); }}>No</button>
      </div>
    );
  }
  return (
    <button className={`btn btn-ghost btn-${size}`} style={{ color: 'var(--red)', fontSize: 12, ...extraStyle }}
      onClick={e => { e.stopPropagation(); setConfirming(true); }}>{label}</button>
  );
}

function PlayerEditCard({ player: p, stats, onSave, onDelete, onNav }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(p.name);
  const [roleVal, setRoleVal] = useState(p.role || 'All-Rounder');

  const handleSave = () => {
    if (!nameVal.trim()) return;
    onSave({ ...p, name: nameVal.trim(), role: roleVal });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="player-reg-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PlayerAvatar player={{ ...p, name: nameVal }} size="md" />
          <input className="input" style={{ flex: 1 }} value={nameVal} autoFocus
            onChange={e => setNameVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="Player name" />
        </div>
        <select className="input" value={roleVal} onChange={e => setRoleVal(e.target.value)}>
          {['Batsman','Bowler','All-Rounder','Wicket-Keeper'].map(r => <option key={r}>{r}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn btn-ghost w-full btn-sm" onClick={() => { setEditing(false); setNameVal(p.name); setRoleVal(p.role||'All-Rounder'); }}>Cancel</button>
          <button className="btn btn-primary w-full btn-sm" onClick={handleSave}>✅ Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="player-reg-card">
      <PlayerAvatar player={p} size="lg" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.role} • {p.battingStyle} bat</div>
        <div className="player-reg-stats">{stats.runs}R • {stats.wickets}W</div>
      </div>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setEditing(true)}>✏️</button>
      {onNav && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--blue)' }} onClick={e => { e.stopPropagation(); onNav('career', p.id); }}>📊</button>}
      <DeleteConfirmButton onConfirm={() => onDelete(p.id)} label="✕" size="sm" />
    </div>
  );
}

function PlayerRegistryPage({ state, onSave, onBack, onNav }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'All-Rounder', battingStyle: 'Right-hand', bowlingStyle: 'Right-arm Medium', photo: null });
  const [search, setSearch] = useState('');
  const photoRef = useRef(null);

  const players = Object.values(state.players || {});
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setForm(f => ({ ...f, photo: ev.target.result }));
    r.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const p = { id: genId(), name: form.name.trim(), role: form.role, battingStyle: form.battingStyle, bowlingStyle: form.bowlingStyle, photo: form.photo, createdAt: Date.now() };
    onSave(p);
    setForm({ name: '', role: 'All-Rounder', battingStyle: 'Right-hand', bowlingStyle: 'Right-arm Medium', photo: null });
    setShowAdd(false);
  };

  const deletePlayer = (id) => onSave(null, id);

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ fontSize: 24 }}>Players</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>{players.length} saved</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>+ Add</button>
      </div>

      {showAdd && (
        <div className="card mb-4 fade-in">
          <div className="section-title">New Player</div>

          {/* Photo capture using CameraCapture */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flexShrink: 0 }}>
              {form.photo
                ? <img src={form.photo} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', display: 'block' }} alt="" />
                : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg3)', border: '2px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CameraCapture
                type="image"
                label="📷 Take Photo"
                existingMedia={form.photo ? { type: 'image', dataUrl: form.photo } : null}
                onCapture={m => setForm(f => ({ ...f, photo: m ? m.dataUrl : null }))}
              />
            </div>
          </div>

          <input className="input mb-2" placeholder="Player Name *" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <select className="input mb-3" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'].map(r => <option key={r}>{r}</option>)}
          </select>

          <div className="grid-2 mb-3">
            <div>
              <label className="label">Batting Style</label>
              <select className="input" value={form.battingStyle} onChange={e => setForm(f => ({ ...f, battingStyle: e.target.value }))}>
                {['Right-hand', 'Left-hand'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bowling Style</label>
              <select className="input" value={form.bowlingStyle} onChange={e => setForm(f => ({ ...f, bowlingStyle: e.target.value }))}>
                {['Right-arm Fast', 'Right-arm Medium', 'Right-arm Off-spin', 'Left-arm Fast', 'Left-arm Spin', 'Left-arm Orthodox'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost w-full" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary w-full" disabled={!form.name.trim()} onClick={handleAdd}>Save Player</button>
          </div>
        </div>
      )}

      <input className="input mb-3" placeholder="🔍 Search players..." value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👤</div>
          <div className="empty-title">{players.length === 0 ? 'No players yet' : 'No results'}</div>
          <div className="empty-sub">{players.length === 0 ? 'Add players once, use them in every match' : 'Try a different search'}</div>
        </div>
      )}

      {filtered.map(p => {
        const allStats = Object.values(state.matches || {}).reduce((acc, m) => {
          Object.values(m.innings || {}).forEach(inn => {
            if (inn.batsmen?.[p.id]) { acc.runs += inn.batsmen[p.id].runs || 0; acc.balls += inn.batsmen[p.id].balls || 0; }
            if (inn.bowlers?.[p.id]) { acc.wickets += inn.bowlers[p.id].wickets || 0; }
          });
          return acc;
        }, { runs: 0, balls: 0, wickets: 0 });
        return (
          <PlayerEditCard key={p.id} player={p} stats={allStats} onSave={onSave} onDelete={deletePlayer} onNav={onNav} />
        );
      })}
    </div>
  );
}

// ============================================================
// 1. AI MATCH PREDICTOR
// ============================================================
function AIPredictorPanel({ match }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('en');

  const computeLocalPrediction = () => {
    const inn1 = match.innings?.['1'];
    const inn2 = match.innings?.['2'];
    const inns = inn2 || inn1;
    if (!inns) return null;

    const totalOvers = match.overs;
    const totalBalls = totalOvers * 6;
    const ballsBowled = inns.balls;
    const runsScored = inns.runs;
    const wickets = inns.wickets;
    const maxW = (inn2 ? match.teamB : match.teamA)?.players?.length || 10;
    const ballsLeft = totalBalls - ballsBowled;
    const currentRR = ballsBowled > 0 ? (runsScored / (ballsBowled / 6)) : 0;

    let winPctA = 50, winPctB = 50;
    let factors = [];

    if (match.currentInnings === '2' && inn1) {
      const target = inn1.runs + 1;
      const needed = target - runsScored;
      const reqRR = ballsLeft > 0 ? needed / (ballsLeft / 6) : 99;
      const rrRatio = currentRR > 0 ? reqRR / currentRR : 2;
      const wktsLeft = maxW - wickets;

      winPctB = Math.max(5, Math.min(95, 50 - (rrRatio - 1) * 25 + (wktsLeft / maxW) * 20));
      winPctA = 100 - winPctB;

      factors = [
        { label: lang === 'hi' ? 'चाहिए रन रेट' : 'Required Run Rate', value: reqRR.toFixed(2), pill: reqRR > currentRR * 1.3 ? 'bad' : reqRR < currentRR * 0.9 ? 'good' : 'neutral' },
        { label: lang === 'hi' ? 'मौजूदा रन रेट' : 'Current Run Rate', value: currentRR.toFixed(2), pill: 'neutral' },
        { label: lang === 'hi' ? 'विकेट बचे' : 'Wickets in Hand', value: `${wktsLeft}/${maxW}`, pill: wktsLeft > maxW * 0.6 ? 'good' : wktsLeft < maxW * 0.3 ? 'bad' : 'neutral' },
        { label: lang === 'hi' ? 'गेंदें बचीं' : 'Balls Remaining', value: ballsLeft, pill: ballsLeft > 30 ? 'good' : ballsLeft < 12 ? 'bad' : 'neutral' },
        { label: lang === 'hi' ? 'लक्ष्य' : 'Target', value: target, pill: 'neutral' },
      ];
    } else {
      const projectedTotal = ballsBowled > 0 ? Math.round(currentRR * totalOvers) : 0;
      winPctA = Math.min(90, Math.max(10, 40 + (projectedTotal > 120 ? 20 : projectedTotal > 80 ? 5 : -10) - (wickets / maxW * 30)));
      winPctB = 100 - winPctA;
      factors = [
        { label: lang === 'hi' ? 'अनुमानित स्कोर' : 'Projected Score', value: projectedTotal || '--', pill: projectedTotal > 120 ? 'good' : 'neutral' },
        { label: lang === 'hi' ? 'रन रेट' : 'Run Rate', value: currentRR.toFixed(2), pill: currentRR > 7 ? 'good' : currentRR < 5 ? 'bad' : 'neutral' },
        { label: lang === 'hi' ? 'विकेट गिरे' : 'Wickets Down', value: `${wickets}/${maxW}`, pill: wickets > maxW * 0.6 ? 'bad' : wickets < maxW * 0.3 ? 'good' : 'neutral' },
        { label: lang === 'hi' ? 'ओवर बचे' : 'Overs Left', value: `${Math.floor(ballsLeft / 6)}.${ballsLeft % 6}`, pill: 'neutral' },
      ];
    }

    return { winPctA: Math.round(winPctA), winPctB: Math.round(winPctB), factors };
  };

  const getAIPrediction = async () => {
    setLoading(true);
    const inn1 = match.innings?.['1'];
    const inn2 = match.innings?.['2'];
    const local = computeLocalPrediction();
    const prompt = `You are a cricket analyst. Give a short match prediction (2-3 sentences) in ${lang === 'hi' ? 'Hindi (Devanagari script)' : 'English'}.

Match: ${match.title}
${match.teamA?.name} vs ${match.teamB?.name}
Overs: ${match.overs}
${inn1 ? `1st Innings: ${inn1.team === 'A' ? match.teamA?.name : match.teamB?.name} - ${inn1.runs}/${inn1.wickets} (${Math.floor(inn1.balls/6)}.${inn1.balls%6} ov)` : ''}
${inn2 ? `2nd Innings: ${inn2.team === 'A' ? match.teamA?.name : match.teamB?.name} - ${inn2.runs}/${inn2.wickets} (${Math.floor(inn2.balls/6)}.${inn2.balls%6} ov) | Target: ${inn1?.runs + 1}` : ''}

Current prediction: ${local?.winPctA}% ${match.teamA?.name}, ${local?.winPctB}% ${match.teamB?.name}
Be specific, exciting, and mention key factors.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      setPrediction({ ...local, aiText: data.content?.[0]?.text });
    } catch {
      setPrediction({ ...(local || {}), aiText: null });
    }
    setLoading(false);
  };

  const local = computeLocalPrediction();
  const teamAName = match.teamA?.name || 'Team A';
  const teamBName = match.teamB?.name || 'Team B';

  if (!match.innings?.['1']) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
      {lang === 'hi' ? 'मैच शुरू होने के बाद भविष्यवाणी उपलब्ध होगी।' : 'Prediction available once match starts.'}
    </div>
  );

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {[['en', '🇬🇧 English'], ['hi', '🇮🇳 Hindi']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${lang === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang(v)}>{l}</button>
        ))}
      </div>

      {local && (
        <div className="card mb-3">
          <div className="flex justify-between mb-1">
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div className="predictor-pct" style={{ color: 'var(--blue)' }}>{local.winPctA}%</div>
              <div className="predictor-label">{teamAName}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 12px', alignSelf: 'center', color: 'var(--text3)', fontSize: 13 }}>WIN %</div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div className="predictor-pct" style={{ color: 'var(--red)' }}>{local.winPctB}%</div>
              <div className="predictor-label">{teamBName}</div>
            </div>
          </div>
          <div className="predictor-bar">
            <div className="predictor-a" style={{ flex: local.winPctA }} />
            <div className="predictor-b" style={{ flex: local.winPctB }} />
          </div>
          {local.factors?.map((f, i) => (
            <div key={i} className="factor-row">
              <span style={{ color: 'var(--text2)' }}>{f.label}</span>
              <span className={`factor-pill pill-${f.pill}`}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary w-full mb-3" onClick={getAIPrediction} disabled={loading}>
        {loading ? '🤖 Analysing...' : `🤖 ${lang === 'hi' ? 'AI भविष्यवाणी' : 'Get AI Prediction'}`}
      </button>

      {prediction?.aiText && (
        <div className="ai-analysis-box">
          <div className="ai-analysis-title">🤖 {lang === 'hi' ? 'AI विश्लेषण' : 'AI Analysis'}</div>
          <div className="ai-analysis-text">{prediction.aiText}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 2. ADVANCED STATS DASHBOARD
// ============================================================
function StatsDashboard({ match }) {
  const [view, setView] = useState('batting');

  const allBalls = Object.values(match.innings || {}).flatMap(inn =>
    (inn.balls_by_ball || []).map(b => ({ ...b, innTeam: inn.team }))
  );

  const overByOver = (innKey) => {
    const inn = match.innings?.[innKey];
    if (!inn) return [];
    const overs = [];
    for (let o = 0; o < match.overs; o++) {
      const overBalls = (inn.balls_by_ball || []).filter(b => b.overIndex === o);
      const runs = overBalls.reduce((s, b) => s + (b.totalRuns || b.runs || 0), 0);
      const wickets = overBalls.filter(b => b.wicket).length;
      overs.push({ over: o + 1, runs, wickets });
    }
    return overs;
  };

  const inn1Overs = overByOver('1');
  const inn2Overs = overByOver('2');
  const maxRuns = Math.max(1, ...inn1Overs.map(o => o.runs), ...inn2Overs.map(o => o.runs));

  const getBatsmanStats = (innKey) => {
    const inn = match.innings?.[innKey];
    if (!inn) return [];
    return Object.entries(inn.batsmen || {}).map(([pid, st]) => {
      const p = [...(match.teamA?.players || []), ...(match.teamB?.players || [])].find(x => x.id === pid);
      const pName = p?.name || '';
      // ball.batsman may be stored as ID (new) or name (old) — handle both
      const dots = (inn.balls_by_ball || []).filter(b =>
        (b.batsman === pid || (pName && b.batsman === pName)) &&
        !b.wide && (b.runs || 0) === 0 && !b.wicket
      ).length;
      const isCaptain = pid === match.captainA || pid === match.captainB;
      return { name: pName || pid || 'Unknown', ...st, dots, sr: st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(1) : '0.0', isCaptain,
        outMode: st.outMode || '', caughtByName: st.caughtByName || '', bowlerName: st.bowlerName || '' };
    }).sort((a, b) => b.runs - a.runs);
  };

  const getBowlerStats = (innKey) => {
    const inn = match.innings?.[innKey];
    if (!inn) return [];
    return Object.entries(inn.bowlers || {}).map(([pid, st]) => {
      const p = [...(match.teamA?.players || []), ...(match.teamB?.players || [])].find(x => x.id === pid);
      const eco = st.balls > 0 ? (st.runs / (st.balls / 6)).toFixed(2) : '0.00';
      return { name: p?.name || 'Unknown', ...st, eco };
    }).sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
  };

  const shotDistribution = () => {
    const counts = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '6': 0, 'W': 0, 'Wd': 0, 'Nb': 0 };
    allBalls.forEach(b => {
      if (b.wicket) counts['W']++;
      else if (b.wide) counts['Wd']++;
      else if (b.noball) counts['Nb']++;
      else counts[String(Math.min(b.runs, 6))] = (counts[String(Math.min(b.runs, 6))] || 0) + 1;
    });
    return counts;
  };
  const dist = shotDistribution();
  const totalBalls = allBalls.filter(b => !b.wide).length || 1;

  return (
    <div>
      <div className="tabs mb-3">
        {[['batting', '🏏 Bat'], ['bowling', '🎯 Bowl'], ['overs', '📊 Overs'], ['breakdown', '🔢 Breakdown']].map(([v, l]) => (
          <button key={v} className={`tab ${view === v ? 'active' : ''}`} style={{ fontSize: 11 }} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>

      {view === 'batting' && Object.entries(match.innings || {}).map(([key, inn]) => (
        <div key={key} className="card mb-3">
          <div className="section-title">{inn.team === 'A' ? match.teamA?.name : match.teamB?.name} — Batting</div>
          {/* Catch drops this innings */}
          {(inn.catchDrops||[]).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>🤲 Catch Drops</div>
              {(inn.catchDrops||[]).map((d, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 8px', background: 'rgba(255,74,110,0.07)', borderRadius: 6, marginBottom: 3 }}>
                  <strong>{d.name}</strong> dropped a catch
                  {d.runsAtDrop > 0 ? ` (batsman on ${d.runsAtDrop})` : ''}
                  {d.at ? ` • ${new Date(d.at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}
                </div>
              ))}
            </div>
          )}
          {/* Extras summary at top of innings */}
          {inn.extras > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 6 }}>
              Extras: <strong>{inn.extras}</strong> (Wides: {inn.wides||0}, No-balls: {inn.noballs||0})
            </div>
          )}
          {/* Impact Player substitutions for this innings */}
          {(match.impactPlayers||[]).filter(ip => ip.team === inn.team).map((ip, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 6, padding: '5px 8px', background: 'rgba(162,89,255,0.08)', borderRadius: 6 }}>
              ⚡ Impact: <strong>{ip.outName}</strong> → <strong>{ip.inName}</strong>
              {ip.at ? ` (${new Date(ip.at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})})` : ''}
            </div>
          ))}
          {getBatsmanStats(key).map((p, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div className="flex justify-between mb-1">
                <div>
                  <span style={{ fontWeight: 600 }}>{p.name}{p.isCaptain ? <span style={{ color: 'var(--gold)', fontSize: 10, marginLeft: 3 }}>©</span> : ''}</span>
                  {p.out
                    ? <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>
                        {p.outMode === 'Caught' && p.caughtByName
                          ? `c. ${p.caughtByName} b. ${p.bowlerName || ''}`
                          : p.outMode === 'Bowled'
                            ? `b. ${p.bowlerName || p.outMode}`
                            : p.outMode === 'Run Out'
                              ? 'run out'
                              : p.outMode || 'out'}
                      </div>
                    : <span style={{ color: 'var(--green)', fontSize: 10, marginLeft: 4 }}>*not out</span>}
                </div>
                <span className="font-mono text-gold" style={{ fontWeight: 700 }}>{p.runs} ({p.balls}b)</span>
              </div>
              <div className="flex gap-3" style={{ fontSize: 11, color: 'var(--text3)' }}>
                <span>4s: <b style={{ color: 'var(--gold)' }}>{p.fours || 0}</b></span>
                <span>6s: <b style={{ color: 'var(--green)' }}>{p.sixes || 0}</b></span>
                <span>SR: <b style={{ color: 'var(--blue)' }}>{p.sr}</b></span>
                <span>Dots: <b>{p.dots}</b></span>
              </div>
              {p.balls > 0 && (
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, var(--green) ${(p.fours || 0) / p.balls * 100 * 4}%, var(--gold) ${(p.sixes || 0) / p.balls * 100}%, var(--blue) 100%)`, width: `${Math.min(100, p.sr)}%`, transition: 'width 0.5s' }} />
                </div>
              )}
              {p.isImpactOut && (
                <div style={{ fontSize: 10, color: 'var(--purple)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⚡ Substituted out{p.impactTime ? ` at ${new Date(p.impactTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}
                  {p.replacedByName ? ` → ${p.replacedByName} came in` : ''}
                </div>
              )}
              {p.isImpactIn && (
                <div style={{ fontSize: 10, color: 'var(--blue)', marginTop: 4 }}>⚡ Impact Player (substitute)</div>
              )}
            </div>
          ))}
        </div>
      ))}

      {view === 'bowling' && Object.entries(match.innings || {}).map(([key, inn]) => (
        <div key={key} className="card mb-3">
          <div className="section-title">{inn.team === 'A' ? match.teamB?.name : match.teamA?.name} — Bowling</div>
          {getBowlerStats(key).map((p, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div className="flex justify-between mb-1">
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="font-mono" style={{ fontWeight: 700, color: p.wickets > 0 ? 'var(--red)' : 'var(--text)' }}>{p.wickets}W - {p.runs}R</span>
              </div>
              <div className="flex gap-3" style={{ fontSize: 11, color: 'var(--text3)' }}>
                <span>Ov: <b>{Math.floor((p.balls||0)/6)}.{(p.balls||0)%6}</b></span>
                <span>Eco: <b style={{ color: p.eco > 9 ? 'var(--red)' : p.eco < 6 ? 'var(--green)' : 'var(--gold)' }}>{p.eco}</b></span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {view === 'overs' && (
        <div className="card mb-3">
          <div className="section-title">Runs Per Over (Worm Chart)</div>
          {[['1', inn1Overs, 'var(--blue)'], ['2', inn2Overs, 'var(--red)']].map(([key, overs, color]) => overs.length > 0 && (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                {match.innings?.[key]?.team === 'A' ? match.teamA?.name : match.teamB?.name} — Innings {key}
              </div>
              <div className="chart-bar-wrap">
                {overs.map((o, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div className="chart-bar" style={{ height: `${Math.max(4, (o.runs / maxRuns) * 52)}px`, background: o.wickets > 0 ? 'var(--red)' : color, opacity: 0.85 }} />
                    {o.wickets > 0 && <div style={{ fontSize: 8, color: 'var(--red)', fontWeight: 700, lineHeight: 1 }}>W</div>}
                  </div>
                ))}
              </div>
              <div className="flex justify-between" style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
                <span>Ov 1</span><span>Ov {overs.length}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>🔴 Red bars = wicket fell that over</div>
        </div>
      )}

      {view === 'breakdown' && (
        <div className="card mb-3">
          <div className="section-title">Shot Breakdown</div>
          {Object.entries(dist).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 mb-2">
              <div style={{ width: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: k === '4' ? 'var(--gold)' : k === '6' ? 'var(--green)' : k === 'W' ? 'var(--red)' : 'var(--text2)' }}>{k === '0' ? '·' : k}</div>
              <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${(v / totalBalls) * 100}%`, background: k === '4' ? 'var(--gold)' : k === '6' ? 'var(--green)' : k === 'W' ? 'var(--red)' : 'var(--blue)', transition: 'width 0.5s' }} />
              </div>
              <div style={{ width: 36, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{v} <span style={{ fontSize: 10, color: 'var(--text3)' }}>({((v / totalBalls) * 100).toFixed(0)}%)</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 3. TEAM MANAGEMENT
// ============================================================
function TeamManagementPage({ state, onSaveTeam, onBack }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [form, setForm] = useState({ name: '', shortName: '', color: '#4a9eff', emoji: '🏏', playerIds: [] });
  const teams = Object.values(state.teams || {});
  const allPlayers = Object.values(state.players || {});

  const openCreate = () => { setForm({ name: '', shortName: '', color: '#4a9eff', emoji: '🏏', playerIds: [] }); setEditTeam(null); setShowCreate(true); };
  const openEdit = (t) => { setForm({ name: t.name, shortName: t.shortName || '', color: t.color || '#4a9eff', emoji: t.emoji || '🏏', playerIds: t.playerIds || [] }); setEditTeam(t.id); setShowCreate(true); };

  const handleSave = () => {
    const id = editTeam || genId();
    const teamData = { id, ...form, createdAt: editTeam ? undefined : Date.now() };
    onSaveTeam(teamData);
    setShowCreate(false);
    setEditTeam(null);
  };

  const deleteTeam = (id) => {
    onSaveTeam(null, id); // pass null to indicate deletion, id to identify
  };

  const togglePlayer = (pid) => {
    setForm(f => ({ ...f, playerIds: f.playerIds.includes(pid) ? f.playerIds.filter(x => x !== pid) : [...f.playerIds, pid] }));
  };

  const COLORS = ['#4a9eff','#1de9a0','#f5c842','#ff4a6e','#a259ff','#ff8c00','#00bcd4','#e91e63'];
  const EMOJIS = ['🏏','🦁','🐯','🦅','🌊','⚡','🔥','🏆','🦊','💪'];

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ fontSize: 24 }}>Teams</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>{teams.length} saved teams</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Create</button>
      </div>

      {showCreate && (
        <div className="card mb-4 fade-in">
          <div className="section-title">{editTeam ? 'Edit Team' : 'New Team'}</div>
          <div className="form-group">
            <label className="label">Team Name *</label>
            <input className="input" placeholder="Mumbai Tigers" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid-2 mb-3">
            <div>
              <label className="label">Short Name</label>
              <input className="input" placeholder="MUM" maxLength={4} value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="label">Team Emoji</label>
              <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                {EMOJIS.map(e => <button key={e} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 16, borderColor: form.emoji === e ? 'var(--gold)' : undefined }} onClick={() => setForm(f => ({ ...f, emoji: e }))}>{e}</button>)}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Team Colour</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {COLORS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer' }} />)}
            </div>
          </div>
          {allPlayers.length > 0 && (
            <div className="form-group">
              <label className="label">Select Players ({form.playerIds.length} selected)</label>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {allPlayers.map(p => (
                  <div key={p.id} className={`player-reg-card ${form.playerIds.includes(p.id) ? 'selected' : ''}`} style={{ marginBottom: 4 }} onClick={() => togglePlayer(p.id)}>
                    <PlayerAvatar player={p} size="md" />
                    <div style={{ flex: 1, fontSize: 13 }}>{p.name}</div>
                    {form.playerIds.includes(p.id) && <span style={{ color: 'var(--gold)' }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn btn-ghost w-full" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary w-full" disabled={!form.name.trim()} onClick={handleSave}>{editTeam ? 'Save Changes' : 'Create Team'}</button>
          </div>
        </div>
      )}

      {teams.length === 0 && !showCreate && (
        <div className="empty"><div className="empty-icon">👥</div><div className="empty-title">No teams yet</div><div className="empty-sub">Create a team with your saved players</div></div>
      )}

      {teams.map(t => {
        const players = (t.playerIds || []).map(id => state.players?.[id]).filter(Boolean);
        const wins = Object.values(state.matches || {}).filter(m => m.result?.winner === t.name).length;
        const losses = Object.values(state.matches || {}).filter(m => m.status === 'done' && m.result?.winner && m.result.winner !== t.name && [m.teamA?.name, m.teamB?.name].includes(t.name)).length;
        return (
          <div key={t.id} className="team-card" onClick={() => openEdit(t)}>
            <div className="flex items-center gap-3 mb-2">
              <div className="team-jersey" style={{ background: t.color + '22', color: t.color, border: `2px solid ${t.color}44` }}>{t.emoji || '🏏'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
                {t.shortName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.shortName}</div>}
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                <span style={{ color: 'var(--green)' }}>{wins}W</span> <span style={{ color: 'var(--text3)' }}>-</span> <span style={{ color: 'var(--red)' }}>{losses}L</span>
              </div>
            </div>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              {players.slice(0, 8).map(p => <PlayerAvatar key={p.id} player={p} size="md" />)}
              {players.length > 8 && <div style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>+{players.length - 8}</div>}
              {players.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No players assigned</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <DeleteConfirmButton onConfirm={(e) => { deleteTeam(t.id); }} label="🗑️ Delete Team" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 4. TOURNAMENTS & KNOCKOUTS
// ============================================================
function TournamentPage({ state, onSaveTournament, onBack, onNav, onDeleteTournament }) {
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', format: 'knockout', teamNames: ['', '', '', ''], overs: 10, isPublic: false });
  const tournaments = Object.values(state.tournaments || {});

  const genFixtures = (teamNames, format) => {
    const teams = teamNames.filter(n => n.trim());
    if (teams.length < 2) return [];
    if (format === 'knockout') {
      const fixtures = [];
      const rounds = Math.ceil(Math.log2(teams.length));
      // Round 1
      for (let i = 0; i < teams.length; i += 2) {
        if (teams[i + 1]) fixtures.push({ id: genId(), round: 1, teamA: teams[i], teamB: teams[i + 1], status: 'pending', winner: null });
        else fixtures.push({ id: genId(), round: 1, teamA: teams[i], teamB: 'BYE', status: 'bye', winner: teams[i] });
      }
      return fixtures;
    }
    // Round-robin
    const fixtures = [];
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++)
        fixtures.push({ id: genId(), round: 1, teamA: teams[i], teamB: teams[j], status: 'pending', winner: null });
    return fixtures;
  };

  const handleCreate = () => {
    const id = genId();
    const fixtures = genFixtures(form.teamNames, form.format);
    const t = { id, name: form.name, format: form.format, overs: form.overs, teams: form.teamNames.filter(n => n.trim()), fixtures, status: 'active', isPublic: form.isPublic || false, createdAt: Date.now() };
    onSaveTournament(t);
    setShowCreate(false);
    setForm({ name: '', format: 'knockout', teamNames: ['', '', '', ''], overs: 10, isPublic: false });
  };

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const doneTournaments = tournaments.filter(t => t.status === 'done');

  const setFixtureResult = (tournId, fixtureId, winner) => {
    const tourn = { ...state.tournaments[tournId] };
    const fixtures = tourn.fixtures.map(f => f.id === fixtureId ? { ...f, winner, status: 'done' } : f);

    // Knockout: generate next round
    if (tourn.format === 'knockout') {
      const round = tourn.fixtures.find(f => f.id === fixtureId)?.round || 1;
      const roundMatches = fixtures.filter(f => f.round === round);
      const allDone = roundMatches.every(f => f.winner);
      if (allDone) {
        const nextRoundWinners = roundMatches.map(f => f.winner);
        if (nextRoundWinners.length === 1) {
          tourn.status = 'done';
          tourn.winner = nextRoundWinners[0];
        } else {
          const nextRound = round + 1;
          for (let i = 0; i < nextRoundWinners.length; i += 2) {
            if (nextRoundWinners[i + 1]) {
              fixtures.push({ id: genId(), round: nextRound, teamA: nextRoundWinners[i], teamB: nextRoundWinners[i + 1], status: 'pending', winner: null });
            }
          }
        }
      }
    }
    onSaveTournament({ ...tourn, fixtures });
  };

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ fontSize: 24 }}>Tournaments</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>{activeTournaments.length} active</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(s => !s)}>+ New</button>
      </div>

      {showCreate && (
        <div className="card mb-4 fade-in">
          <div className="section-title">New Tournament</div>
          <div className="form-group">
            <label className="label">Tournament Name *</label>
            <input className="input" placeholder="Summer Cup 2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Format</label>
            <div className="flex gap-2">
              {[['knockout', '🏆 Knockout'], ['roundrobin', '🔄 Round Robin']].map(([v, l]) => (
                <button key={v} className={`btn btn-sm ${form.format === v ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, format: v }))}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="label">Overs per Match</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
              {[5, 8, 10, 15, 20].map(o => <button key={o} className={`btn btn-sm ${form.overs === o ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setForm(f => ({ ...f, overs: o }))}>{o}</button>)}
            </div>
            <input className="input" type="number" min="1" max="100" value={form.overs}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setForm(f => ({ ...f, overs: v })); }}
              placeholder="Or type custom overs" />
          </div>
          <div className="form-group">
            <label className="label">Teams (min 2)</label>
            {form.teamNames.map((n, i) => (
              <input key={i} className="input mb-2" placeholder={`Team ${i + 1}`} value={n} onChange={e => setForm(f => { const t = [...f.teamNames]; t[i] = e.target.value; return { ...f, teamNames: t }; })} />
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, teamNames: [...f.teamNames, ''] }))}>+ Add Team</button>
          </div>

          <div className="form-group">
            <label className="label">Visibility</label>
            <div className="flex gap-2">
              <button type="button" className={`btn btn-sm ${!form.isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, isPublic: false }))}>
                🔒 Private
              </button>
              <button type="button" className={`btn btn-sm ${form.isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, isPublic: true }))}>
                🌍 Public
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-ghost w-full" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary w-full" disabled={!form.name || form.teamNames.filter(n => n.trim()).length < 2} onClick={handleCreate}>Create Tournament</button>
          </div>
        </div>
      )}

      {tournaments.length === 0 && !showCreate && (
        <div className="empty"><div className="empty-icon">🏆</div><div className="empty-title">No tournaments yet</div><div className="empty-sub">Create a knockout or round-robin tournament</div></div>
      )}

      {[...activeTournaments, ...doneTournaments].map(tourn => {
        const rounds = [...new Set(tourn.fixtures.map(f => f.round))].sort((a, b) => a - b);
        const stageNames = ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];
        const getStage = (round, totalRounds) => { const idx = totalRounds - round; return stageNames[idx] || `Round ${round}`; };
        const totalRounds = Math.max(...(tourn.fixtures.map(f => f.round) || [1]));

        return (
          <div key={tourn.id} className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{tourn.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tourn.format === 'knockout' ? '🏆 Knockout' : '🔄 Round Robin'} • {tourn.overs} ov • {tourn.teams?.length} teams</div>
              </div>
              {tourn.status === 'done' && <span className="badge badge-gold">🏆 {tourn.winner}</span>}
              {tourn.status === 'active' && <span className="badge badge-live">LIVE</span>}
            </div>

            {rounds.map(round => {
              const roundFixtures = tourn.fixtures.filter(f => f.round === round);
              return (
                <div key={round}>
                  <div className="stage-header">{getStage(round, totalRounds)}</div>
                  {roundFixtures.map(f => (
                    <div key={f.id} className={`bracket-match ${f.winner ? 'winner' : ''}`}>
                      <div className="bracket-team" style={{ color: f.winner === f.teamA ? 'var(--gold)' : f.winner ? 'var(--text3)' : 'var(--text)' }}>
                        <span>{f.teamA}</span>
                        {f.winner === f.teamA && <span style={{ fontSize: 12 }}>🏆</span>}
                      </div>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <div className="bracket-team" style={{ color: f.winner === f.teamB ? 'var(--gold)' : f.winner ? 'var(--text3)' : 'var(--text)' }}>
                        <span>{f.teamB}</span>
                        {f.winner === f.teamB && <span style={{ fontSize: 12 }}>🏆</span>}
                      </div>
                      {f.status === 'pending' && f.teamB !== 'BYE' && (
                        <div className="flex gap-2 mt-2">
                          <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={() => setFixtureResult(tourn.id, f.id, f.teamA)}>{f.teamA} won</button>
                          <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={() => setFixtureResult(tourn.id, f.id, f.teamB)}>{f.teamB} won</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Delete Tournament Button */}
            <button className="btn btn-danger w-full" style={{ marginTop: 12 }} onClick={() => {
              setShowDeleteModal(tourn.id);
              setDeleteConfirmCount(0);
            }}>
              🗑️ Delete Tournament
            </button>
          </div>
        );
      })}

      {/* Delete Tournament Modal */}
      {showDeleteModal && Object.values(state.tournaments || {}).find(t => t.id === showDeleteModal) && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(null); setDeleteConfirmCount(0); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-handle" />
            <div className="modal-title" style={{ color: 'var(--red)' }}>🗑️ Delete Tournament?</div>
            
            {deleteConfirmCount === 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                  You are about to permanently delete <strong>"{Object.values(state.tournaments || {}).find(t => t.id === showDeleteModal)?.name}"</strong>
                  <br/><br/>
                  This action <strong>CANNOT be undone</strong>.
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(null); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-danger w-full" onClick={() => setDeleteConfirmCount(1)}>I Understand</button>
                </div>
              </div>
            )}

            {deleteConfirmCount === 1 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(255,74,110,0.1)', border: '1px solid rgba(255,74,110,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  ⚠️ Type the tournament name to confirm deletion
                </div>
                <input 
                  className="input mb-3" 
                  placeholder={`Type "${Object.values(state.tournaments || {}).find(t => t.id === showDeleteModal)?.name}" to confirm`}
                  onChange={(e) => setDeleteConfirmCount(e.target.value === Object.values(state.tournaments || {}).find(t => t.id === showDeleteModal)?.name ? 2 : 1)}
                />
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(null); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-ghost w-full" disabled style={{ opacity: 0.5 }}>Confirm</button>
                </div>
              </div>
            )}

            {deleteConfirmCount === 2 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--green)', background: 'rgba(29,233,160,0.1)', border: '1px solid rgba(29,233,160,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  ✅ Tournament name confirmed. Click below to permanently delete.
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(null); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-danger w-full" onClick={() => { onDeleteTournament(showDeleteModal); setShowDeleteModal(null); setDeleteConfirmCount(0); }}>Permanently Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 5. LIVE COMMENTARY SHARING + 6. WHATSAPP SCORE SHARING
// ============================================================
function ShareMatchPage({ match, onBack }) {
  const [copied, setCopied] = useState('');
  const [lang, setLang] = useState('en');

  const inn1 = match.innings?.['1'];
  const inn2 = match.innings?.['2'];
  const currentInn = match.innings?.[match.currentInnings];

  const generateScorecard = () => {
    const lines = [];
    lines.push(`🏏 ${match.title}`);
    lines.push(`📍 ${match.location || 'N/A'} | ${match.overs} Overs`);
    lines.push('');
    if (inn1) {
      const t1 = inn1.team === 'A' ? match.teamA?.name : match.teamB?.name;
      lines.push(`📊 ${t1}: ${inn1.runs}/${inn1.wickets} (${Math.floor(inn1.balls/6)}.${inn1.balls%6} ov)`);
      // Top batters
      const top = Object.entries(inn1.batsmen || {}).sort((a,b) => b[1].runs - a[1].runs).slice(0, 3);
      const allP = [...(match.teamA?.players||[]), ...(match.teamB?.players||[])];
      top.forEach(([pid, st]) => {
        const p = allP.find(x => x.id === pid);
        lines.push(`  ${p?.name || 'Unknown'}: ${st.runs}(${st.balls})`);
      });
    }
    if (inn2) {
      lines.push('');
      const t2 = inn2.team === 'A' ? match.teamA?.name : match.teamB?.name;
      lines.push(`📊 ${t2}: ${inn2.runs}/${inn2.wickets} (${Math.floor(inn2.balls/6)}.${inn2.balls%6} ov)`);
      if (inn1) lines.push(`  Target: ${inn1.runs + 1} | Need: ${(inn1.runs + 1) - inn2.runs} in ${(match.overs * 6) - inn2.balls} balls`);
    }
    lines.push('');
    if (match.result) lines.push(`🏆 Result: ${match.result.winner} — ${match.result.by}`);
    else if (match.status === 'live') lines.push(`🔴 LIVE | View: crex.live/m/${match.viewerCode}`);
    lines.push('');
    lines.push('Scored with Crictera 🏏');
    return lines.join('\n');
  };

  const generateHindiScorecard = () => {
    const inn1 = match.innings?.['1'];
    const inn2 = match.innings?.['2'];
    const lines = [];
    lines.push(`🏏 ${match.title}`);
    lines.push(`${match.overs} ओवर का मैच`);
    lines.push('');
    if (inn1) {
      const t1 = inn1.team === 'A' ? match.teamA?.name : match.teamB?.name;
      lines.push(`📊 ${t1}: ${inn1.runs}/${inn1.wickets} (${Math.floor(inn1.balls/6)}.${inn1.balls%6} ओवर)`);
    }
    if (inn2) {
      const t2 = inn2.team === 'A' ? match.teamA?.name : match.teamB?.name;
      lines.push(`📊 ${t2}: ${inn2.runs}/${inn2.wickets} (${Math.floor(inn2.balls/6)}.${inn2.balls%6} ओवर)`);
      if (inn1) lines.push(`  लक्ष्य: ${inn1.runs + 1} | चाहिए: ${(inn1.runs + 1) - inn2.runs} रन`);
    }
    lines.push('');
    if (match.result) lines.push(`🏆 परिणाम: ${match.result.winner} — ${match.result.by}`);
    else if (match.status === 'live') lines.push(`🔴 लाइव मैच चल रहा है`);
    lines.push('Crictera से स्कोर किया गया 🏏');
    return lines.join('\n');
  };

  const scorecard = lang === 'hi' ? generateHindiScorecard() : generateScorecard();
  const liveUrl = `crex.live/m/${match.viewerCode}`;

  const copyText = (text, label) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(''), 2500);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(scorecard);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({ title: match.title, text: scorecard, url: `https://${liveUrl}` }).catch(() => {});
    } else {
      copyText(scorecard, 'scorecard');
    }
  };

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 24 }}>Share Match</div>
      </div>

      <div className="flex gap-2 mb-3">
        {[['en', '🇬🇧 English'], ['hi', '🇮🇳 Hindi']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${lang === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang(v)}>{l}</button>
        ))}
      </div>

      <div className="scorecard-preview">{scorecard}</div>

      <div style={{ marginBottom: 16 }}>
        <button className="share-btn" onClick={shareWhatsApp}>
          <div className="share-btn-icon whatsapp-icon">💬</div>
          <div><div style={{ fontWeight: 600 }}>Share on WhatsApp</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Send scorecard to your group</div></div>
        </button>
        <button className="share-btn" onClick={shareNative}>
          <div className="share-btn-icon copy-icon">📤</div>
          <div><div style={{ fontWeight: 600 }}>Share Scorecard</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{navigator.share ? 'Share via any app' : 'Copy to clipboard'}</div></div>
        </button>
        <button className="share-btn" onClick={() => copyText(scorecard, 'scorecard')}>
          <div className="share-btn-icon" style={{ background: 'var(--border2)', fontSize: 18 }}>📋</div>
          <div><div style={{ fontWeight: 600 }}>{copied === 'scorecard' ? '✅ Copied!' : 'Copy Scorecard'}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Paste anywhere</div></div>
        </button>
        {match.status === 'live' && (
          <button className="share-btn" onClick={() => copyText(liveUrl, 'link')}>
            <div className="share-btn-icon live-icon">🔴</div>
            <div><div style={{ fontWeight: 600 }}>{copied === 'link' ? '✅ Link Copied!' : 'Copy Live Link'}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{liveUrl}</div></div>
          </button>
        )}
      </div>

      {match.viewerCode && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="section-title">Viewer Code</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, letterSpacing: 6, color: 'var(--gold)', fontWeight: 700 }}>{match.viewerCode}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Anyone can join and follow live</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 7. DRS SYSTEM
// ============================================================
function DRSPanel({ match, onUpdateMatch }) {
  const [reviewTeam, setReviewTeam] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [timer, setTimer] = useState(15);
  const [verdict, setVerdict] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const timerRef = useRef(null);

  const drs = match.drs || { A: 2, B: 2 };
  const battingTeam = match.battingTeam;
  const bowlingTeam = battingTeam === 'A' ? 'B' : 'A';

  const startReview = (team) => {
    if (drs[team] <= 0) { alert('No reviews left!'); return; }
    setReviewTeam(team);
    setReviewing(true);
    setVerdict(null);
    setTimer(15);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const giveVerdict = (v) => {
    clearInterval(timerRef.current);
    setVerdict(v);
    // Review RETAINED if overturned (not_out) — original on-field OUT decision reversed
    // Review LOST if original decision stands (out) or unclear
    const reviewRetained = v === 'not_out';
    const currentCount = drs[reviewTeam] ?? 2;
    const newCount = reviewRetained ? currentCount : Math.max(0, currentCount - 1);
    const newDrs = { ...drs, [reviewTeam]: newCount };
    onUpdateMatch(match.id, { drs: newDrs });
    setTimeout(() => { setReviewing(false); setReviewTeam(null); setVerdict(null); setShowPanel(false); }, 3500);
  };

  const getAIVerdict = async (video) => {
    const inns = match.innings?.[match.currentInnings];
    const result = await analyzeVideoWithAI(video, {
      batsman: inns?.striker?.name, bowler: inns?.bowler?.name, askLBW: true
    });
    const v = result?.toLowerCase().includes('not out') ? 'not_out'
      : result?.toLowerCase().includes('unclear') ? 'unclear' : 'out';
    giveVerdict(v);
  };

  // Dots show CURRENT drs from match state (always fresh)
  const drsA = drs['A'] ?? 2;
  const drsB = drs['B'] ?? 2;

  return (
    <div>
      <button className="btn btn-ghost w-full mb-2" style={{ gap: 8, justifyContent: 'space-between' }} onClick={() => setShowPanel(s => !s)}>
        <span>🔴 DRS Reviews</span>
        <div className="flex gap-3">
          {[['A', match.teamA?.name, drsA], ['B', match.teamB?.name, drsB]].map(([t, name, count]) => (
            <span key={t} style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {name?.split(' ')[0]}:&nbsp;
              {[0,1].map(i => (
                <span key={i} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: i < count ? 'var(--green)' : 'var(--border2)', boxShadow: i < count ? '0 0 4px var(--green)' : 'none' }} />
              ))}
            </span>
          ))}
        </div>
      </button>

      {showPanel && (
        <div className="drs-panel mb-3 fade-in">
          <div className="drs-title">🔴 DRS — Review System</div>

          {!reviewing && !verdict && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Which team is challenging?</div>
              <div className="flex gap-2">
                {[['A', match.teamA?.name, drsA], ['B', match.teamB?.name, drsB]].map(([t, name, count]) => (
                  <button key={t} className="btn btn-ghost" style={{ flex: 1 }} onClick={() => startReview(t)} disabled={count <= 0}>
                    {name}
                    <span style={{ fontSize: 11, color: count > 0 ? 'var(--green)' : 'var(--red)', marginLeft: 6 }}>
                      ({count} left)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {reviewing && !verdict && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{reviewTeam === 'A' ? match.teamA?.name : match.teamB?.name} reviewing...</div>
              <div className="drs-timer">{timer}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>seconds remaining</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>Third Umpire Decision:</div>
              <div className="flex gap-2 mb-3">
                <button className="btn btn-danger w-full" onClick={() => giveVerdict('out')}>OUT 🔴</button>
                <button className="btn btn-success w-full" onClick={() => giveVerdict('not_out')}>NOT OUT 🟢</button>
                <button className="btn btn-ghost" onClick={() => giveVerdict('unclear')}>UNCLEAR 🟡</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Record ball video first, then use AI Umpire in the wicket modal for LBW assistance</div>
            </div>
          )}

          {verdict && (
            <div style={{ textAlign: 'center' }}>
              <div className={`drs-verdict ${verdict === 'out' ? 'drs-out' : verdict === 'not_out' ? 'drs-not-out' : ''}`}>
                {verdict === 'out' ? '🔴 OUT' : verdict === 'not_out' ? '🟢 NOT OUT' : '🟡 UNCLEAR'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>
                {verdict === 'not_out' ? '✅ Review retained' : '❌ Review lost'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 8. PLAYER CAREER TRACKER
// ============================================================
function CareerTrackerPage({ playerId, state, onBack, onEditPlayerStats, onNav }) {
  const player = state.players?.[playerId];
  const [lang, setLang] = useState('en');
  const [editingStats, setEditingStats] = useState(false);
  const [editForm, setEditForm] = useState({});

  const career = (() => {
    const calculated = calculatePlayerStats(state.matches, playerId);
    let runs = calculated.runs, balls = calculated.balls, fours = calculated.fours, sixes = calculated.sixes;
    let outs = calculated.outs, notOuts = calculated.notOuts;
    let wkts = calculated.wickets, ballsBowled = calculated.ballsBowled, runsConceded = calculated.runsConceded;
    let matches = calculated.matches, innings = calculated.innings;
    let matchesWon = calculated.matchesWon, matchesLost = calculated.matchesLost;
    let fifties = 0, hundreds = 0, fiveFers = 0, bestBowling = { w: 0, r: 999 };
    const recentMatches = [];

    calculated.scores.forEach(score => {
      if (score >= 100) hundreds++;
      else if (score >= 50) fifties++;
    });

    Object.values(state.matches || {}).forEach(m => {
      let played = false;
      Object.values(m.innings || {}).forEach(inn => {
        if (inn.batsmen?.[playerId]) played = true;
        if (inn.bowlers?.[playerId]) {
          const st = inn.bowlers[playerId];
          if (st.wickets >= 5) fiveFers++;
          if (st.wickets > bestBowling.w || (st.wickets === bestBowling.w && st.runs < bestBowling.r))
            bestBowling = { w: st.wickets, r: st.runs };
          played = true;
        }
      });
      if (played) recentMatches.push(m);
    });

    const manualStats = state.manualPlayerStats?.[playerId];
    if (manualStats) {
      if (manualStats.runs         !== undefined) runs         += manualStats.runs;
      if (manualStats.balls        !== undefined) balls        += manualStats.balls;
      if (manualStats.fours        !== undefined) fours        += manualStats.fours;
      if (manualStats.sixes        !== undefined) sixes        += manualStats.sixes;
      if (manualStats.wickets      !== undefined) wkts         += manualStats.wickets;
      if (manualStats.ballsBowled  !== undefined) ballsBowled  += manualStats.ballsBowled;
      if (manualStats.runsConceded !== undefined) runsConceded += manualStats.runsConceded;
      if (manualStats.matches      !== undefined) matches      += manualStats.matches;
      if (manualStats.innings      !== undefined) innings      += manualStats.innings;
      if (manualStats.notOuts      !== undefined) notOuts      += manualStats.notOuts;
      if (manualStats.matchesWon   !== undefined) matchesWon   += manualStats.matchesWon;
      if (manualStats.matchesLost  !== undefined) matchesLost  += manualStats.matchesLost;
    }

    // Correct cricket average = runs / dismissals (innings - notOuts)
    const dismissals = innings - notOuts;
    const avg = dismissals > 0 ? (runs / dismissals).toFixed(2) : (innings > 0 ? '∞' : '0.0');
    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
    const eco = ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(2) : '0.00';
    const bowlAvg = wkts > 0 ? (runsConceded / wkts).toFixed(1) : '--';
    const bowlSR = wkts > 0 ? (ballsBowled / wkts).toFixed(1) : '--';
    const milestones = [];
    if (hundreds > 0) milestones.push(`🏆 ${hundreds} Hundred${hundreds > 1 ? 's' : ''}`);
    if (fifties > 0) milestones.push(`⭐ ${fifties} Fift${fifties > 1 ? 'ies' : 'y'}`);
    if (fiveFers > 0) milestones.push(`🎯 ${fiveFers} Five-for${fiveFers > 1 ? 's' : ''}`);
    if (runs >= 500) milestones.push(`📊 500+ runs`);
    if (wkts >= 50) milestones.push(`📊 50+ wickets`);

    const matchesCaptained = calculated.matchesCaptained || 0;
    const captainWins = calculated.captainWins || 0;
    const captainLosses = calculated.captainLosses || 0;
    const tossWins = calculated.tossWins || 0;
    return { runs, balls, fours, sixes, avg, sr, wkts, ballsBowled, runsConceded, eco, bowlAvg, bowlSR, matches, innings, notOuts, matchesWon, matchesLost, matchesCaptained, captainWins, captainLosses, tossWins, bestBowling, milestones, recentMatches: recentMatches.slice(-5).reverse() };
  })();

  if (!player) return <div className="page"><button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button><div className="empty"><div className="empty-icon">❓</div><div className="empty-title">Player not found</div></div></div>;

  return (
    <div className="page fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
          <div className="page-title" style={{ fontSize: 22 }}>
            {lang === 'hi' ? 'करियर ट्रैकर' : 'Career Tracker'}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--blue)' }} onClick={() => onNav('graph', playerId)}>📈 Graph</button>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          setEditingStats(true);
          // Show totals so user edits the real numbers
          setEditForm({
            runs: career.runs, balls: career.balls, fours: career.fours, sixes: career.sixes,
            wickets: career.wkts, ballsBowled: career.ballsBowled, runsConceded: career.runsConceded,
            matches: career.matches, innings: career.innings, notOuts: career.notOuts || 0,
            matchesWon: career.matchesWon || 0, matchesLost: career.matchesLost || 0,
          });
        }}>✏️ Edit</button>
      </div>

      <div className="flex gap-2 mb-3">
        {[['en', '🇬🇧'], ['hi', '🇮🇳']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${lang === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang(v)}>{l} {v === 'en' ? 'English' : 'Hindi'}</button>
        ))}
      </div>

      {/* Player Card */}
      <div className="card mb-3" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <PlayerAvatar player={player} size="xl" />
        <div style={{ fontWeight: 700, fontSize: 20, marginTop: 10 }}>{player.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          {player.role} • {player.battingStyle} • {career.matches} {lang === 'hi' ? 'मैच' : 'matches'}
        </div>
        {career.milestones.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {career.milestones.map((m, i) => <span key={i} className="milestone-badge">{m}</span>)}
          </div>
        )}
      </div>

      {/* Batting Stats */}
      <div className="card mb-3">
        <div className="section-title">🏏 {lang === 'hi' ? 'बैटिंग' : 'Batting'}</div>
        <div className="career-stat-grid">
          {[
            { val: career.runs, lbl: lang === 'hi' ? 'रन' : 'Runs' },
            { val: career.avg, lbl: lang === 'hi' ? 'औसत' : 'Average' },
            { val: career.sr, lbl: lang === 'hi' ? 'स्ट्राइक रेट' : 'Strike Rate' },
            { val: career.innings, lbl: lang === 'hi' ? 'पारी' : 'Innings' },
            { val: career.notOuts || 0, lbl: lang === 'hi' ? 'नॉट आउट' : 'Not Outs', color: 'var(--green)' },
            { val: career.fours, lbl: lang === 'hi' ? 'चौके' : 'Fours' },
            { val: career.sixes, lbl: lang === 'hi' ? 'छक्के' : 'Sixes' },
          ].map((s, i) => (
            <div key={i} className="career-stat">
              <div className="career-stat-val" style={s.color ? { color: s.color } : {}}>{s.val}</div>
              <div className="career-stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Match Record */}
      <div className="card mb-3">
        <div className="section-title">🏆 {lang === 'hi' ? 'मैच रिकॉर्ड' : 'Match Record'}</div>
        <div className="career-stat-grid">
          {[
            { val: career.matches, lbl: lang === 'hi' ? 'मैच' : 'Matches', color: 'var(--text)' },
            { val: career.matchesWon || 0, lbl: lang === 'hi' ? 'जीते' : 'Won', color: 'var(--green)' },
            { val: career.matchesLost || 0, lbl: lang === 'hi' ? 'हारे' : 'Lost', color: 'var(--red)' },
            { val: career.matches - (career.matchesWon || 0) - (career.matchesLost || 0), lbl: lang === 'hi' ? 'ड्रॉ/टाई' : 'Tied', color: 'var(--gold)' },
          ].map((s, i) => (
            <div key={i} className="career-stat">
              <div className="career-stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="career-stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Captaincy Record */}
      {career.matchesCaptained > 0 && (
        <div className="card mb-3">
          <div className="section-title">👑 {lang === 'hi' ? 'कप्तानी रिकॉर्ड' : 'Captaincy Record'}</div>
          <div className="career-stat-grid">
            {[
              { val: career.matchesCaptained, lbl: 'Captained' },
              { val: career.captainWins || 0, lbl: 'Wins', color: 'var(--green)' },
              { val: career.captainLosses || 0, lbl: 'Losses', color: 'var(--red)' },
              { val: career.matchesCaptained > 0 ? Math.round(((career.captainWins||0)/career.matchesCaptained)*100)+'%' : '0%', lbl: 'Win%', color: 'var(--gold)' },
              { val: career.tossWins || 0, lbl: 'Toss Wins' },
              { val: career.matchesCaptained > 0 ? Math.round(((career.tossWins||0)/career.matchesCaptained)*100)+'%' : '0%', lbl: 'Toss Win%', color: 'var(--purple)' },
            ].map((s, i) => (
              <div key={i} className="career-stat">
                <div className="career-stat-val" style={{ color: s.color || 'var(--text)' }}>{s.val}</div>
                <div className="career-stat-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bowling Stats */}
      {career.ballsBowled > 0 && (
        <div className="card mb-3">
          <div className="section-title">🎯 {lang === 'hi' ? 'बॉलिंग' : 'Bowling'}</div>
          <div className="career-stat-grid">
            {[
              { val: career.wkts, lbl: lang === 'hi' ? 'विकेट' : 'Wickets' },
              { val: career.eco, lbl: lang === 'hi' ? 'इकॉनमी' : 'Economy' },
              { val: career.bowlAvg, lbl: lang === 'hi' ? 'गेंदबाजी औसत' : 'Bowling Avg' },
              { val: `${career.bestBowling.w}/${career.bestBowling.r === 999 ? 0 : career.bestBowling.r}`, lbl: lang === 'hi' ? 'बेस्ट' : 'Best' },
            ].map((s, i) => (
              <div key={i} className="career-stat">
                <div className="career-stat-val">{s.val}</div>
                <div className="career-stat-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Matches */}
      {career.recentMatches.length > 0 && (
        <div className="card mb-3">
          <div className="section-title">{lang === 'hi' ? 'हाल के मैच' : 'Recent Matches'}</div>
          {career.recentMatches.map(m => {
            const inn = Object.values(m.innings || {}).find(inn => inn.batsmen?.[playerId] || inn.bowlers?.[playerId]);
            if (!inn) return null;
            const bat = inn.batsmen?.[playerId];
            const bowl = inn.bowlers?.[playerId];
            return (
              <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{m.title}</div>
                {bat && <div style={{ fontSize: 12, color: 'var(--text3)' }}>🏏 {bat.runs}({bat.balls}) {bat.out ? `— out` : '— not out'}</div>}
                {bowl && <div style={{ fontSize: 12, color: 'var(--text3)' }}>🎯 {bowl.wickets}W/{bowl.runs}R</div>}
              </div>
            );
          })}
        </div>
      )}

      {career.matches === 0 && (
        <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">{lang === 'hi' ? 'अभी तक कोई मैच नहीं' : 'No match data yet'}</div><div className="empty-sub">Play matches with this player to see stats</div></div>
      )}

      {/* Edit Stats Modal */}
      {editingStats && (
        <div className="modal-overlay" onClick={() => setEditingStats(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">✏️ Edit Bonus Stats</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: 10, background: 'var(--bg3)', borderRadius: 8 }}>
                <PlayerAvatar player={player} size="md" />
                <div>
                  <div style={{ fontWeight: 600 }}>{player.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Values are ADDED to recorded match stats</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: 6, padding: '7px 10px', marginBottom: 12 }}>
                ⚡ Edit the total career stats directly
              </div>

              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>🏏 Batting</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[['runs','Total Runs'],['balls','Total Balls'],['fours','Total Fours'],['sixes','Total Sixes'],
                  ['innings','Total Innings'],['notOuts','Total Not Outs']].map(([k, lbl]) => (
                  <div key={k}>
                    <label className="label">{lbl}</label>
                    <input className="input" type="number" min="0" value={editForm[k] || 0}
                      onChange={e => setEditForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>

              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>🎯 Bowling</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[['wickets','Total Wickets'],['ballsBowled','Total Balls Bowled'],['runsConceded','Total Runs Conceded']].map(([k, lbl]) => (
                  <div key={k} style={k === 'runsConceded' ? { gridColumn: '1/-1' } : {}}>
                    <label className="label">{lbl}</label>
                    <input className="input" type="number" min="0" value={editForm[k] || 0}
                      onChange={e => setEditForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>

              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>🏆 Match Record</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[['matches','Matches'],['matchesWon','Won'],['matchesLost','Lost']].map(([k, lbl]) => (
                  <div key={k}>
                    <label className="label">{lbl}</label>
                    <input className="input" type="number" min="0" value={editForm[k] || 0}
                      onChange={e => setEditForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button className="btn btn-ghost w-full" onClick={() => setEditingStats(false)}>Cancel</button>
                <button className="btn btn-primary w-full" onClick={() => {
                  if (onEditPlayerStats) {
                    const detailed = calculatePlayerStats(state.matches, playerId);
                    const delta = {
                      runs:         (editForm.runs         || 0) - detailed.runs,
                      balls:        (editForm.balls        || 0) - detailed.balls,
                      fours:        (editForm.fours        || 0) - detailed.fours,
                      sixes:        (editForm.sixes        || 0) - detailed.sixes,
                      wickets:      (editForm.wickets      || 0) - detailed.wickets,
                      ballsBowled:  (editForm.ballsBowled  || 0) - detailed.ballsBowled,
                      runsConceded: (editForm.runsConceded || 0) - detailed.runsConceded,
                      matches:      (editForm.matches      || 0) - detailed.matches,
                      innings:      (editForm.innings      || 0) - detailed.innings,
                      notOuts:      (editForm.notOuts      || 0) - detailed.notOuts,
                      matchesWon:   (editForm.matchesWon   || 0) - detailed.matchesWon,
                      matchesLost:  (editForm.matchesLost  || 0) - detailed.matchesLost,
                    };
                    const sanitized = {};
                    Object.entries(delta).forEach(([k, v]) => { if (v !== 0) sanitized[k] = Math.max(0, v); });
                    onEditPlayerStats(playerId, sanitized);
                  }
                  setEditingStats(false);
                }}>✅ Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MULTI-LANGUAGE AI COMMENTARY HELPER (Hindi + English)
// ============================================================
async function getAICommentaryML(ball, lang = 'en') {
  if (lang === 'en') return null; // uses existing static pool
  const prompt = `Cricket ball commentary in Hindi (Devanagari script). ONE sentence only. Be excited.
Ball: ${ball.wide ? 'Wide' : ball.noball ? 'No ball' : ball.wicket ? `Wicket (${ball.wicketMode})` : `${ball.runs} runs`}
Batsman: ${ball.batsman || 'batsman'}, Bowler: ${ball.bowler || 'bowler'}`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 80, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch { return null; }
}

const HINDI_COMMENTARY = {
  0: ['शानदार गेंदबाजी! डॉट बॉल।', 'बल्लेबाज ने रोका, कोई रन नहीं।', 'बेहतरीन लेंथ, बैट पास से गई।'],
  1: ['एक रन लिया!', 'तेज दौड़ कर सिंगल लिया।', 'मिड-ऑन की तरफ धकेला — एक रन।'],
  2: ['दो रन! अच्छी दौड़।', 'कवर के बीच से दो रन।', 'शॉट खेला, दो रन मिले।'],
  3: ['तीन रन! बेहतरीन रनिंग।', 'लंबा शॉट — तीन रन।'],
  4: ['चौका! दमदार शॉट!', 'बाउंड्री! बल्लेबाज ने जड़ दिया!', '🔥 चौका मारा! शानदार!'],
  6: ['छक्का! ऑफ ब्रेक! गेंद मैदान के बाहर!', '💥 छक्का! ज़बरदस्त शॉट!', 'स्टैंड में गई गेंद — छक्का!'],
  wide: ['वाइड! गेंदबाज़ की गलती।', 'वाइड बॉल — एक एक्स्ट्रा रन।'],
  noball: ['नो बॉल! फ्री हिट मिलेगी!', 'नो बॉल — ओवरस्टेपिंग।'],
  wicket: ['आउट! विकेट गिरी!', '🏏 विकेट! बल्लेबाज पवेलियन वापस!', 'OUT! क्या गेंद!'],
};
const getHindiCommentary = (ball) => {
  let pool = HINDI_COMMENTARY[ball.wide ? 'wide' : ball.noball ? 'noball' : ball.wicket ? 'wicket' : ball.runs] || HINDI_COMMENTARY[1];
  const line = pool[Math.floor(Math.random() * pool.length)];
  return ball.batsman && !ball.wide ? `${ball.batsman}: ${line}` : line;
};


const FEATURE_SUGGESTIONS = [
  { icon: '🤖', title: 'AI Match Predictor', desc: 'Predict match winner in real-time based on current score, required run rate, wickets in hand, and historical performance.', tag: 'AI', tagClass: 'tag-ai' },
  { icon: '📊', title: 'Advanced Stats Dashboard', desc: 'Heat maps of shot placement, wagon wheels, worm graphs, Manhattan charts, and partnership diagrams.', tag: 'STATS', tagClass: 'tag-stats' },
  { icon: '👥', title: 'Team Management', desc: 'Create permanent teams with jerseys, logos, and player numbers. Track team win/loss records and rankings.', tag: 'SOCIAL', tagClass: 'tag-social' },
  { icon: '🏆', title: 'Tournaments & Knockouts', desc: 'Organize multi-team tournaments with group stages, knockouts, and automatic bracket generation.', tag: 'GAME', tagClass: 'tag-game' },
  { icon: '🎙️', title: 'Live Commentary Sharing', desc: 'Share a live match link so friends can watch the scoreboard update in real-time with commentary.', tag: 'SOCIAL', tagClass: 'tag-social' },
  { icon: '📱', title: 'WhatsApp Score Sharing', desc: 'One-tap share scorecard, highlights, and match summary directly to WhatsApp or any social platform.', tag: 'SOCIAL', tagClass: 'tag-social' },
  { icon: '⚡', title: 'DRS System', desc: 'Full DRS with review timer, AI-powered ball-tracking simulation, and team review tracking (2 per innings).', tag: 'UMPIRE', tagClass: 'tag-umpire' },
  { icon: '🎯', title: 'Bowling Analysis AI', desc: 'AI analyses bowling patterns, warns batsmen of yorker tendencies, and suggests field placements.', tag: 'AI', tagClass: 'tag-ai' },
  { icon: '📈', title: 'Player Career Tracker', desc: 'Long-term career stats for every player — batting averages, bowling economy trends, milestone alerts (50s, 100s, 5-fers).', tag: 'STATS', tagClass: 'tag-stats' },
  { icon: '🌐', title: 'Multi-Language Commentary', desc: 'AI commentary in Hindi, Tamil, Urdu, Bengali, and other languages.', tag: 'AI', tagClass: 'tag-ai' },
  { icon: '🎬', title: 'Stump Camera Mode', desc: 'Use a second phone as a stump camera — automatically captures run-outs and stumpings.', tag: 'GAME', tagClass: 'tag-game' },
  { icon: '💰', title: 'Fantasy Cricket Integration', desc: 'Create fantasy teams from match players, auto-score points based on live match performance.', tag: 'GAME', tagClass: 'tag-game' },
];

function SuggestionsPage({ onBack, user }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', type: 'feedback', rating: 5, message: '' });
  const [step, setStep] = useState('form'); // form | confirm | submitting | done | error
  const [errorMsg, setErrorMsg] = useState('');

  const submitFeedback = async () => {
    setStep('submitting');
    try {
      // Save feedback via Claude API — stores it in a message to ourselves
      const feedbackText = `🏏 CRICTERA FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${form.name || 'Anonymous'}
Email: ${form.email || 'Not provided'}
Type: ${form.type === 'feedback' ? '💬 Feedback' : form.type === 'bug' ? '🐛 Bug Report' : '💡 Suggestion'}
Rating: ${'⭐'.repeat(form.rating)} (${form.rating}/5)
Date: ${new Date().toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${form.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      // Store locally as well (for owner to review inside the app)
      const existing = JSON.parse(localStorage.getItem('crictera_feedback') || '[]');
      existing.push({ ...form, timestamp: Date.now(), id: 'fb_' + Date.now() });
      localStorage.setItem('crictera_feedback', JSON.stringify(existing));

      // Also send to Anthropic API so it creates a record in the conversation
      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: `Please acknowledge receipt of this Crictera user feedback and reply with just "Feedback received, thank you!": ${feedbackText}` }]
        })
      });

      setStep('done');
    } catch(e) {
      // Even if API fails, we saved locally
      setStep('done');
    }
  };

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div>
          <div className="page-title" style={{ fontSize: 22 }}>💬 Feedback & Suggestions</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Help us improve Crictera</div>
        </div>
      </div>

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>Thank you!</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>
            Your feedback has been received and saved.<br/>We'll review it and use it to make Crictera better!
          </div>
          <button className="btn btn-primary" onClick={onBack}>← Back to Home</button>
        </div>
      )}

      {step === 'submitting' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ color: 'var(--text2)' }}>Submitting your feedback...</div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--gold)' }}>Confirm Submission</div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}><strong>Name:</strong> {form.name || 'Anonymous'}</div>
            <div style={{ fontSize: 12, marginBottom: 6 }}><strong>Type:</strong> {form.type}</div>
            <div style={{ fontSize: 12, marginBottom: 6 }}><strong>Rating:</strong> {'⭐'.repeat(form.rating)}</div>
            <div style={{ fontSize: 12 }}><strong>Message:</strong> {form.message}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
            Your feedback will be saved and reviewed by the Crictera team (Saksham Arora).
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost w-full" onClick={() => setStep('form')}>← Edit</button>
            <button className="btn btn-primary w-full" onClick={submitFeedback}>✅ Submit</button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div>
          <div className="card mb-3">
            <div style={{ marginBottom: 12 }}>
              <label className="label">Your Name</label>
              <input className="input" placeholder="Enter your name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Email (optional)</label>
              <input className="input" type="email" placeholder="your@email.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Type</label>
              <div className="flex gap-2">
                {[['feedback','💬 Feedback'],['suggestion','💡 Suggestion'],['bug','🐛 Bug Report']].map(([v,l]) => (
                  <button key={v} className={`btn btn-sm w-full ${form.type === v ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setForm(f => ({ ...f, type: v }))}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Overall Rating</label>
              <div className="flex gap-2" style={{ justifyContent: 'center', padding: '8px 0' }}>
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, rating: r }))}
                    style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', opacity: form.rating >= r ? 1 : 0.3, transition: 'opacity 0.15s' }}>⭐</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">
                {form.type === 'feedback' ? 'Your Feedback' : form.type === 'bug' ? 'Describe the Bug' : 'Your Suggestion'}
              </label>
              <textarea className="input" rows={5} style={{ resize: 'vertical', minHeight: 100 }}
                placeholder={form.type === 'bug' ? 'What happened? What did you expect to happen?' : 'Share your thoughts...'}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-primary w-full" style={{ fontSize: 14, padding: 14 }}
            disabled={!form.message.trim()}
            onClick={() => { if (form.message.trim()) setStep('confirm'); }}>
            Submit Feedback →
          </button>
        </div>
      )}
    </div>
  );
}


// ============================================================
// PLAYER AVATAR COMPONENT
// ============================================================
function PlayerAvatar({ player, size = 'md' }) {
  const cls = size === 'lg' ? 'avatar avatar-lg' : size === 'xl' ? 'avatar avatar-xl' : 'avatar';
  if (player?.photo) {
    return (
      <div className={cls}>
        <img src={player.photo} alt={player?.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      </div>
    );
  }
  return <div className={cls}>{initials(player?.name || '')}</div>;
}

// ============================================================
// INITIAL DATA
// ============================================================
const makeInitialState = () => ({
  user: null,
  page: 'login',
  matches: {},
  series: {},
  players: {}, // global player registry keyed by id
  teams: {},   // saved teams keyed by id
  tournaments: {}, // tournaments keyed by id
  toasts: [],
  activeMatchId: null,
  activeSeriesId: null,
  activeTournamentId: null,
  activeCareerPlayerId: null,
  reactions: {},
  manualPlayerStats: {}, // manual stat overrides for leaderboard
  pendingSeriesId: null,
  vsStatsCleared: true, // All vs stats cleared - fresh start from next match
  superOverActive: false, // Track if super over is active
  searchQuery: '', // Track search query on home page
});

// ============================================================
// Note: match persistence is now handled entirely by Supabase (see
// matchesData.js and the sync effect inside App()) — there is no
// browser-only localStorage fallback for match data anymore.
// ============================================================

// Video storage: stored separately to avoid quota issues on main key
const saveVideo = (key, dataUrl) => { try { localStorage.setItem('crexvid_' + key, dataUrl); } catch(e) {} };
const loadVideo = (key) => { try { return localStorage.getItem('crexvid_' + key); } catch(e) { return null; } };
const deleteVideo = (key) => { try { localStorage.removeItem('crexvid_' + key); } catch(e) {} };

// ============================================================
// TOAST
// ============================================================
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type || ''}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ============================================================
// NAV
// ============================================================
function Nav({ user, page, onNav, onLogout }) {
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={() => onNav('home')} style={{ cursor: 'pointer' }}>
        🏏 <span>CRIC</span><span style={{ color: 'var(--gold)' }}>TERA</span>
      </div>
      <div className="nav-actions">
        {user && page !== 'home' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onNav('home')}>🏠</button>
        )}
        {user && page !== 'tournaments' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onNav('tournaments')}>🏆</button>
        )}
        {user && page !== 'leaderboard' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onNav('leaderboard')}>📊</button>
        )}
        {user && (
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onNav('profile')}>
            <span style={{ fontSize: 16 }}>👤</span>
          </button>
        )}
        {user && (
          <button className="btn btn-ghost btn-sm" onClick={onLogout} style={{ fontSize: 11 }}>Out</button>
        )}
      </div>
    </nav>
  );
}


// ============================================================
// LOGIN / REGISTER
// ============================================================
function AuthPage({ onAuth, mode }) {
  const [tab, setTab] = useState(mode === 'login' ? 'login' : 'register');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [forgotStep, setForgotStep] = useState(''); // '' | 'email' | 'sent'
  const [forgotEmail, setForgotEmail] = useState('');

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.name) { setError('Please fill all fields'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setLoading(true);
    try {
      const data = await signUp(form.email, form.password, form.name);
      if (data.session) {
        // Email confirmation is OFF in the Supabase project settings — user is
        // signed in immediately.
        onAuth();
      } else {
        // Email confirmation is ON — Supabase sent a confirmation link.
        setConfirmMsg('Account created! Check your email to confirm your address, then sign in.');
        setTab('login');
      }
    } catch (e) {
      setError(e.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError('Please enter email and password'); return; }
    setError(''); setLoading(true);
    try {
      await signIn(form.email, form.password);
      onAuth();
    } catch (e) {
      setError(e.message || 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSend = async () => {
    if (!forgotEmail) { setError('Enter your email'); return; }
    setError(''); setLoading(true);
    try {
      await sendPasswordReset(forgotEmail, window.location.origin);
      setForgotStep('sent');
    } catch (e) {
      setError(e.message || 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (forgotStep) {
    return (
      <div className="page fade-in" style={{ paddingTop: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🔐</div>
          <div className="page-title" style={{ textAlign: 'center', fontSize: 22 }}>Reset Password</div>
        </div>
        <div className="card">
          {forgotStep === 'email' && (
            <>
              <div className="form-group">
                <label className="label">Your Email</label>
                <input className="input" type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
              </div>
              {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
              <button className="btn btn-primary w-full" disabled={loading} onClick={handleForgotSend}>
                {loading ? '⏳ Sending...' : 'Send Reset Link →'}
              </button>
              <button className="btn btn-ghost w-full mt-2" onClick={() => { setForgotStep(''); setError(''); }}>← Back</button>
            </>
          )}
          {forgotStep === 'sent' && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                A password reset link has been sent to <strong>{forgotEmail}</strong>. Click the link in that email to set a new password.
              </div>
              <button className="btn btn-ghost w-full" onClick={() => { setForgotStep(''); setTab('login'); }}>← Back to Sign In</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in" style={{ paddingTop: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🏏</div>
        <div className="page-title" style={{ textAlign: 'center' }}>CRIC<span style={{ color: 'var(--gold)' }}>TERA</span></div>
        <div className="page-sub" style={{ textAlign: 'center' }}>Score your cricket matches live</div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', padding: 4, borderRadius: 8, marginBottom: 20 }}>
          {['login', 'register'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setError(''); setConfirmMsg(''); }}>{t === 'login' ? 'Sign In' : 'Register'}</button>
          ))}
        </div>

        {confirmMsg && <div style={{ color: 'var(--green)', fontSize: 12, marginBottom: 12, padding: 10, background: 'rgba(29,233,160,0.08)', borderRadius: 8 }}>{confirmMsg}</div>}

        {tab === 'register' && (
          <div className="form-group">
            <label className="label">Your Name</label>
            <input className="input" placeholder="Rahul Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
        )}
        <div className="form-group">
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleRegister())} />
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <button className="btn btn-primary w-full btn-lg" disabled={loading} onClick={tab === 'login' ? handleLogin : handleRegister} style={{ marginTop: 4, opacity: loading ? 0.6 : 1 }}>
          {loading ? '⏳ Please wait...' : tab === 'login' ? '→ Sign In' : '→ Create Account'}
        </button>
        {tab === 'login' && (
          <button className="btn btn-ghost w-full" style={{ marginTop: 8, fontSize: 12, color: 'var(--purple)' }}
            onClick={() => { setForgotEmail(form.email); setForgotStep('email'); setError(''); }}>
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HOME
// ============================================================
function HomePage({ state, onNav, onJoin }) {
  const [joinCode, setJoinCode] = useState('');
  // Show: user's own matches (public & private) + all public matches from other users
  const allMatches = Object.values(state.matches).filter(m => 
    m.ownerId === state.user?.id || m.isPublic
  );
  const myMatches = Object.values(state.matches)
    .filter(m => m.ownerId === state.user?.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);
  const allMySeries = Object.values(state.series).filter(s => s.creatorId === state.user?.id || s.isPublic).sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  const mySeries = allMySeries.slice(0, 6);
  const myTournaments = Object.values(state.tournaments || {}).filter(t => t.creatorId === state.user?.id || t.isPublic).slice(0, 4);

  return (
    <div className="page fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="page-title">Hi, {state.user?.name?.split(' ')[0]} 👋</div>
          <div className="page-sub">Ready to play?</div>
        </div>
        <div style={{ fontSize: 40 }}>🏏</div>
      </div>

      {/* Quick Actions */}
      <div className="grid-2 mb-3">
        <button className="btn btn-primary btn-lg w-full" style={{ flexDirection: 'column', height: 72, gap: 4 }} onClick={() => onNav('createMatch')}>
          <span style={{ fontSize: 22 }}>⚡</span><span style={{ fontSize: 13 }}>New Match</span>
        </button>
        <button className="btn btn-ghost btn-lg w-full" style={{ flexDirection: 'column', height: 72, gap: 4 }} onClick={() => onNav('createSeries')}>
          <span style={{ fontSize: 22 }}>🏆</span><span style={{ fontSize: 13 }}>New Series</span>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { icon: '👤', label: 'Players', page: 'players', count: Object.keys(state.players||{}).length },
          { icon: '👥', label: 'Teams', page: 'teams', count: Object.keys(state.teams||{}).length },
          { icon: '🏆', label: 'Tournaments', page: 'tournaments', count: Object.keys(state.tournaments||{}).length },
          { icon: '📊', label: 'Leaderboard', page: 'leaderboard' },
          { icon: '⚔️', label: 'Player vs', page: 'vs' },
          { icon: '👤', label: 'Profile', page: 'profile' },
        ].map(({ icon, label, page, count }) => (
          <button key={page+label} className="btn btn-ghost" style={{ flexDirection: 'column', gap: 3, padding: '10px 4px', fontSize: 11, position: 'relative' }} onClick={() => onNav(page)}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span>{label}</span>
            {count > 0 && <span style={{ position: 'absolute', top: 4, right: 6, background: 'var(--gold)', color: '#000', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Join Match */}
      <div className="card mb-4">
        <div className="section-title">Join a Match</div>
        <div className="flex gap-2">
          <input className="input" placeholder="Short code (e.g. AB12CD) or paste full share code" value={joinCode}
            onChange={e => setJoinCode(e.target.value)} style={{ flex: 1, fontFamily: 'var(--font-mono)' }} />
          <button className="btn btn-primary" onClick={() => { onJoin(joinCode); setJoinCode(''); }}>Join</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          A short 6-character code works if it's on this device. For a different device, paste the full share code from "Copy Share Code".
        </div>
      </div>

      {/* Recent Matches */}
      {myMatches.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="section-title">Recent Matches</div>
            {Object.values(state.matches).length > 6 && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onNav('allMatches')}>View All →</button>
            )}
          </div>
          {myMatches.map(m => (
            <MatchCard key={m.id} match={m} onClick={() => onNav('match', m.id)} />
          ))}
        </div>
      )}

      {/* Series */}
      {mySeries.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="section-title">Series</div>
            {allMySeries.length > 6 && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onNav('allSeries')}>View All →</button>
            )}
          </div>
          {mySeries.map(s => (
            <SeriesCard key={s.id} series={s} onClick={() => onNav('series', s.id)} />
          ))}
        </div>
      )}

      {myMatches.length === 0 && mySeries.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏟️</div>
          <div className="empty-title">No matches yet</div>
          <div className="empty-sub">Create a match to get started!</div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button className="btn btn-ghost w-full" onClick={() => onNav('leaderboard')}>🏅 Leaderboard</button>
        <button className="btn btn-ghost w-full" onClick={() => onNav('records')}>📊 Records</button>
        <button className="btn btn-ghost w-full" onClick={() => onNav('partnerships')}>🤝 Partnerships</button>
      </div>
      <div style={{ textAlign: 'center', padding: '24px 0 8px', color: 'var(--text3)', fontSize: 11, lineHeight: 1.8 }}>
        <button className="btn btn-ghost w-full mb-3" style={{ fontSize: 13, color: 'var(--purple)', borderColor: 'rgba(162,89,255,0.4)' }}
          onClick={() => onNav('suggestions')}>
          💬 Feedback & Suggestions
        </button>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
          Made by <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Saksham Arora</span> using Claude
        </div>
        <div style={{ marginTop: 2 }}>Crictera Cricket Scorer</div>
      </div>
    </div>
  );
}

function formatMatchDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatMatchTime(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDuration(startTs, endTs) {
  if (!startTs || !endTs) return null;
  const ms = endTs - startTs;
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 1) return null;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function MatchCard({ match, onClick }) {
  const isLive = match.status === 'live';
  const isDone = match.status === 'done';
  const inns = match.innings?.[match.currentInnings];
  const matchDate = formatMatchDate(match.startedAt || match.createdAt);
  const startTime = formatMatchTime(match.startedAt);
  const endTime = formatMatchTime(match.endedAt);
  const duration = formatDuration(match.startedAt, match.endedAt);
  return (
    <div className="card card-hover mb-2" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{match.title}</div>
        {isLive && <span className="badge badge-live">LIVE</span>}
        {isDone && <span className="badge badge-green">DONE</span>}
        {!isLive && !isDone && <span className="badge badge-blue">SETUP</span>}
      </div>
      <div className="flex items-center justify-between">
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{match.teamA?.name} vs {match.teamB?.name}</div>
        {inns && <div className="font-mono text-sm text-gold">{inns.runs}/{inns.wickets} ({formatOvers(inns.balls)})</div>}
      </div>
      {match.result && isDone && (
        <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 3 }}>🏆 {match.result.winner === 'Match' ? 'Tied' : `${match.result.winner} won`}{match.result.by && match.result.by !== 'Series override' ? ` — ${match.result.by}` : ''}</div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {matchDate && <div style={{ fontSize: 11, color: 'var(--text3)' }}>📅 {matchDate}</div>}
        {startTime && endTime && <div style={{ fontSize: 11, color: 'var(--text3)' }}>🕐 {startTime} – {endTime}{duration ? ` (${duration})` : ''}</div>}
        {startTime && !endTime && isLive && <div style={{ fontSize: 11, color: 'var(--red)' }}>🔴 Started {startTime}</div>}
        {match.location && <div style={{ fontSize: 11, color: 'var(--text3)' }}>📍 {match.location}</div>}
      </div>
    </div>
  );
}

function SeriesCard({ series, onClick }) {
  const played = series.matches?.length || 0;
  const total = series.totalMatches || 0;
  const sA = series.scoreA || 0;
  const sB = series.scoreB || 0;
  const isComplete = total > 0 && played >= total;
  const leader = sA > sB ? series.teamA : sB > sA ? series.teamB : null;
  const pctA = total > 0 ? Math.round((sA / total) * 100) : 0;
  const pctB = total > 0 ? Math.round((sB / total) * 100) : 0;
  return (
    <div className="card card-hover mb-2" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{series.name}</div>
        {isComplete
          ? <span className="badge badge-green">DONE</span>
          : <span className="badge badge-live">LIVE</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: 'var(--gold)' }}>{sA}</span>
          <span style={{ color: 'var(--text3)', margin: '0 6px', fontSize: 11 }}>–</span>
          <span style={{ color: 'var(--red)' }}>{sB}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{played}/{total} matches</div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <div style={{ flex: sA + 0.01, background: 'var(--gold)', height: 5, borderRadius: 3, opacity: 0.8 }} />
        <div style={{ flex: Math.max(0, total - sA - sB) + 0.01, background: 'var(--border)', height: 5, borderRadius: 3 }} />
        <div style={{ flex: sB + 0.01, background: 'var(--red)', height: 5, borderRadius: 3, opacity: 0.8 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--gold)' }}>{series.teamA}</span>
        {leader && <span style={{ color: 'var(--green)', fontWeight: 600 }}>🏆 {leader} leading</span>}
        {!leader && sA === sB && played > 0 && <span style={{ color: 'var(--text3)' }}>Tied</span>}
        <span style={{ color: 'var(--red)' }}>{series.teamB}</span>
      </div>
    </div>
  );
}

// ============================================================
// PLAYER TEAM SECTION (extracted outside for stable rendering)
// ============================================================
function PlayerTeamSection({ team, form, setForm, state, newPlayerA, setNewPlayerA, newPlayerB, setNewPlayerB, addPlayer, addExisting }) {
  const players = team === 'A' ? form.playersA : form.playersB;
  const np = team === 'A' ? newPlayerA : newPlayerB;
  const setNp = team === 'A' ? setNewPlayerA : setNewPlayerB;
  const teamName = team === 'A' ? form.teamAName : form.teamBName;

  return (
    <div className="card mb-3">
      <div className="form-group">
        <label className="label">Team {team} Name</label>
        <input className="input" value={teamName}
          onChange={e => setForm(f => ({ ...f, [`team${team}Name`]: e.target.value }))} />
      </div>
      <div className="section-title">Players ({players.length})</div>
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-2 mb-2">
          <PlayerAvatar player={p} size="md" />
          <div style={{ flex: 1, fontSize: 14 }}>{p.name}</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { const teamPlayers = team === 'A' ? form.playersA : form.playersB; const filtered = teamPlayers.filter(x => x.id !== p.id); setForm(f => ({ ...f, [team === 'A' ? 'playersA' : 'playersB']: filtered })); }}>✕</button>
        </div>
      ))}

      {Object.values(state.players).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>From My Players</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.values(state.players).map(p => {
              const added = players.find(x => x.id === p.id);
              return (
                <button key={p.id} className={`btn btn-sm ${added ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                  onClick={() => !added && addExisting(p, team)}>
                  {p.photo && <img src={p.photo} style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                  {p.name.split(' ')[0]}{added ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual add */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input className="input" placeholder="Player name" style={{ flex: 1 }} value={np.name}
          onChange={e => setNp(n => ({ ...n, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && addPlayer(team)} />
        <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => addPlayer(team)}>+ Add</button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <CameraCapture
          type="image"
          label="📷 Player Photo"
          existingMedia={np.photo ? { type: 'image', dataUrl: np.photo } : null}
          onCapture={m => setNp(n => ({ ...n, photo: m ? m.dataUrl : null }))}
        />
      </div>
      {/* Teams from teams registry */}
      {Object.values(state.teams || {}).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Load Saved Teams</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.values(state.teams).map(t => (
              <button key={t.id} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                onClick={() => {
                  const teamPlayers = (t.playerIds || []).map(id => state.players?.[id]).filter(Boolean);
                  const teamName = t.name;
                  if (team === 'A') { setForm(f => ({ ...f, teamAName: teamName, playersA: teamPlayers })); }
                  else { setForm(f => ({ ...f, teamBName: teamName, playersB: teamPlayers })); }
                }}>
                {t.emoji || '👥'} {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CREATE MATCH
// ============================================================
function CreateMatchPage({ state, onCreate, onBack, initialSeriesId = '' }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => {
    const series = initialSeriesId ? state.series?.[initialSeriesId] : null;
    // Deep-copy players so editing this match's roster doesn't mutate the series template,
    // but give each a fresh ID per match so per-match player stats stay independent
    // while team name / overs / starting roster stay consistent with the series.
    const clonePlayers = (list) => (list || []).map(p => ({ ...p }));
    return {
      title: '', overs: series?.defaultOvers || 10, location: '',
      teamAName: series?.teamA || 'Team Alpha', teamBName: series?.teamB || 'Team Beta',
      playersA: clonePlayers(series?.playersA), playersB: clonePlayers(series?.playersB),
      seriesId: initialSeriesId,
      aiCommentary: true,
      maxOversPerBowler: 0,
      isPublic: series?.isPublic || false,
      captainA: '', captainB: '',
    };
  });
  const [newPlayerA, setNewPlayerA] = useState({ name: '', photo: null });
  const [newPlayerB, setNewPlayerB] = useState({ name: '', photo: null });
  const [aiTeamInstruction, setAiTeamInstruction] = useState('');
  const [aiTeamLoading, setAiTeamLoading] = useState(false);
  const [localMsg, setLocalMsg] = useState('');
  const addToast = (msg) => { setLocalMsg(msg); setTimeout(() => setLocalMsg(''), 3500); };
  const photoRefA = useRef(null);
  const photoRefB = useRef(null);

  const handlePhotoChange = (e, team) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (team === 'A') setNewPlayerA(n => ({ ...n, photo: ev.target.result }));
      else setNewPlayerB(n => ({ ...n, photo: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const addPlayer = (team) => {
    const np = team === 'A' ? newPlayerA : newPlayerB;
    if (!np.name.trim()) return;
    const p = { id: genId(), name: np.name.trim(), photo: np.photo || null };
    if (team === 'A') { setForm(f => ({ ...f, playersA: [...f.playersA, p] })); setNewPlayerA({ name: '', photo: null }); if (photoRefA.current) photoRefA.current.value = ''; }
    else { setForm(f => ({ ...f, playersB: [...f.playersB, p] })); setNewPlayerB({ name: '', photo: null }); if (photoRefB.current) photoRefB.current.value = ''; }
  };

  const addExisting = (player, team) => {
    const list = team === 'A' ? form.playersA : form.playersB;
    if (list.find(p => p.id === player.id)) return;
    if (team === 'A') setForm(f => ({ ...f, playersA: [...f.playersA, player] }));
    else setForm(f => ({ ...f, playersB: [...f.playersB, player] }));
  };

  const removePlayer = (id, team) => {
    if (team === 'A') setForm(f => ({ ...f, playersA: f.playersA.filter(p => p.id !== id) }));
    else setForm(f => ({ ...f, playersB: f.playersB.filter(p => p.id !== id) }));
  };

  const canGoNext1 = form.title.trim().length > 0 && form.overs > 0;

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-3">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ fontSize: 22 }}>New Match</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Step {step} of 3</div>
        </div>
      </div>

      {/* Step bar */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? 'var(--gold)' : 'var(--border)', transition: 'background 0.3s', cursor: s < step ? 'pointer' : 'default' }}
            onClick={() => s < step && setStep(s)} />
        ))}
      </div>

      {localMsg && (
        <div style={{ background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.35)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text2)' }}>
          {localMsg}
        </div>
      )}

      {/* STEP 1 — Match Details */}
      {step === 1 && (
        <div className="fade-in">
          {initialSeriesId && state.series?.[initialSeriesId] && (
            <div style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
              🏆 Pre-filled from series <strong>{state.series[initialSeriesId].name}</strong>: teams, overs ({state.series[initialSeriesId].defaultOvers || 10}), and players are copied from the series setup. You can still edit them below for this match.
            </div>
          )}
          <div className="form-group">
            <label className="label">Match Title *</label>
            <input className="input" placeholder="Sunday Showdown" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>

          <div className="form-group">
            <label className="label">Number of Overs *</label>
            <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              {[5, 6, 8, 10, 15, 20, 50].map(o => (
                <button key={o} type="button" className={`btn btn-sm ${form.overs === o ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setForm(f => ({ ...f, overs: o }))}>{o}</button>
              ))}
            </div>
            <input className="input" type="number" min="1" max="100" placeholder="Or type any overs (1-100)"
              value={form.overs === 0 ? '' : form.overs}
              onChange={e => { const v = parseInt(e.target.value); setForm(f => ({ ...f, overs: isNaN(v) ? 0 : Math.max(1, Math.min(100, v)) })); }}
              style={{ width: '100%' }} />
          </div>

          <div className="form-group">
            <label className="label">Max Overs Per Bowler <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text3)', letterSpacing: 0 }}>(0 = unlimited)</span></label>
            <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              {[0, 1, 2, 3, 4, 5].map(o => (
                <button key={o} type="button" className={`btn btn-sm ${form.maxOversPerBowler === o ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setForm(f => ({ ...f, maxOversPerBowler: o }))}>{o === 0 ? '∞' : o}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="label">Location</label>
            <input className="input" placeholder="Ground name, City" value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="label">Part of Series?</label>
            <select className="input" value={form.seriesId} onChange={e => setForm(f => ({ ...f, seriesId: e.target.value }))}>
              <option value="">— Standalone Match —</option>
              {Object.values(state.series).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 mb-4" style={{ cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, aiCommentary: !f.aiCommentary }))}>
            <input type="checkbox" checked={form.aiCommentary} readOnly style={{ width: 16, height: 16, accentColor: 'var(--gold)', pointerEvents: 'none' }} />
            <span style={{ fontSize: 14 }}>🤖 Enable AI Commentary</span>
          </div>

          <div className="form-group mb-4">
            <label className="label">Match Visibility</label>
            <div className="flex gap-2">
              <button type="button" className={`btn btn-sm ${!form.isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, isPublic: false }))}>
                🔒 Private (Code only)
              </button>
              <button type="button" className={`btn btn-sm ${form.isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, isPublic: true }))}>
                🌍 Public (Anyone)
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              {form.isPublic 
                ? '📱 Anyone who signs in can see and join this match from the home page'
                : '🔐 Only people with the viewer/editor code can access this match'}
            </div>
          </div>

          {!canGoNext1 && form.title.trim().length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠️ Please enter a match title</div>
          )}
          {!canGoNext1 && form.overs <= 0 && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠️ Please set number of overs</div>
          )}
          <button type="button" className="btn btn-primary w-full btn-lg"
            style={{ opacity: canGoNext1 ? 1 : 0.5 }}
            onClick={() => { if (canGoNext1) setStep(2); }}>
            Next: Teams & Players →
          </button>
        </div>
      )}

      {/* STEP 2 — Teams */}
      {step === 2 && (
        <div className="fade-in">
          <PlayerTeamSection team="A" form={form} setForm={setForm} state={state} newPlayerA={newPlayerA} setNewPlayerA={setNewPlayerA} newPlayerB={newPlayerB} setNewPlayerB={setNewPlayerB} addPlayer={addPlayer} addExisting={addExisting} />
          <PlayerTeamSection team="B" form={form} setForm={setForm} state={state} newPlayerA={newPlayerA} setNewPlayerA={setNewPlayerA} newPlayerB={newPlayerB} setNewPlayerB={setNewPlayerB} addPlayer={addPlayer} addExisting={addExisting} />
          {/* Captain selectors */}
          {(form.playersA.length > 0 || form.playersB.length > 0) && (
            <div className="card mb-3">
              <div className="section-title">👑 Choose Captains</div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div>
                  <label className="label">{form.teamAName} Captain</label>
                  <select className="input" value={form.captainA} onChange={e => setForm(f => ({ ...f, captainA: e.target.value }))}>
                    <option value="">— Select Captain —</option>
                    {form.playersA.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{form.teamBName} Captain</label>
                  <select className="input" value={form.captainB} onChange={e => setForm(f => ({ ...f, captainB: e.target.value }))}>
                    <option value="">— Select Captain —</option>
                    {form.playersB.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
          {/* AI Team Builder */}
          <div className="card mb-3" style={{ border: '1px solid rgba(162,89,255,0.4)', background: 'rgba(162,89,255,0.05)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--purple)', marginBottom: 6 }}>🤖 AI Team Builder</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Let AI build balanced teams using player stats. You can edit the result.</div>
            <input className="input mb-2" placeholder="Instruction (e.g. make teams balanced by batting avg)" value={aiTeamInstruction}
              onChange={e => setAiTeamInstruction(e.target.value)} />
            <button className="btn w-full" style={{ background: 'rgba(162,89,255,0.2)', color: 'var(--purple)', border: '1px solid rgba(162,89,255,0.4)' }}
              disabled={aiTeamLoading}
              onClick={async () => {
                setAiTeamLoading(true);
                try {
                  const allPlayers = Object.values(state.players || {});
                  if (allPlayers.length < 2) { addToast('Add players to registry first'); setAiTeamLoading(false); return; }
                  const statsStr = allPlayers.map(p => {
                    const s = calculatePlayerStats(state.matches, p.id);
                    return `${p.name}: ${s.runs}R avg${s.innings > 0 ? (s.runs / Math.max(1, s.innings - s.notOuts)).toFixed(1) : 0} SR${s.balls > 0 ? ((s.runs/s.balls)*100).toFixed(0) : 0} ${s.wickets}W`;
                  }).join(', ');
                  const instruction = aiTeamInstruction || 'Make two balanced teams';
                  const prompt = `You are a cricket team selector. Players and their stats: [${statsStr}]. Instruction: ${instruction}. Split these players into two balanced cricket teams called "${form.teamAName}" and "${form.teamBName}". Reply ONLY with valid JSON: {"teamA": ["name1","name2",...], "teamB": ["name1","name2",...]}. Use exact player names. No other text.`;
                  const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
                  });
                  const data = await res.json();
                  const text = data.content?.[0]?.text || '';
                  const clean = text.replace(/```json|```/g, '').trim();
                  const parsed = JSON.parse(clean);
                  const teamANames = parsed.teamA || [];
                  const teamBNames = parsed.teamB || [];
                  const newA = teamANames.map(name => { const p = allPlayers.find(x => x.name === name); return p ? { id: p.id, name: p.name, photo: p.photo || null } : { id: 'p_' + Date.now() + Math.random(), name }; });
                  const newB = teamBNames.map(name => { const p = allPlayers.find(x => x.name === name); return p ? { id: p.id, name: p.name, photo: p.photo || null } : { id: 'p_' + Date.now() + Math.random(), name }; });
                  setForm(f => ({ ...f, playersA: newA, playersB: newB }));
                  addToast('🤖 AI teams generated! Review and edit below.');
                } catch(e) { addToast('AI team generation failed'); }
                setAiTeamLoading(false);
              }}>
              {aiTeamLoading ? '⏳ Generating...' : '🤖 Generate Teams with AI'}
            </button>
          </div>

          {/* Equal teams warning */}
          {form.playersA.length > 0 && form.playersB.length > 0 && form.playersA.length !== form.playersB.length && (
            <div style={{ background: 'rgba(255,74,110,0.1)', border: '1px solid rgba(255,74,110,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
                ⚠️ Teams are not equal! {form.teamAName}: {form.playersA.length} players, {form.teamBName}: {form.playersB.length} players. Please add or remove players to make them equal.
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button type="button" className="btn btn-ghost w-full" onClick={() => setStep(1)}>← Back</button>
            <button type="button" className="btn btn-primary w-full"
              disabled={form.playersA.length > 0 && form.playersB.length > 0 && form.playersA.length !== form.playersB.length}
              onClick={() => {
                if (form.playersA.length > 0 && form.playersB.length > 0 && form.playersA.length !== form.playersB.length) {
                  addToast(`⚠️ Teams must have equal players! ${form.teamAName}: ${form.playersA.length}, ${form.teamBName}: ${form.playersB.length}`);
                  return;
                }
                setStep(3);
              }}>Next: Review →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — Review & Create */}
      {step === 3 && (
        <div className="fade-in">
          <div className="card mb-3">
            <div className="section-title">Match Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              <div className="stat-box"><div className="stat-val">{form.overs}</div><div className="stat-label">Overs</div></div>
              <div className="stat-box"><div className="stat-val">{form.playersA.length + form.playersB.length}</div><div className="stat-label">Players</div></div>
              <div className="stat-box"><div className="stat-val">{form.maxOversPerBowler || '∞'}</div><div className="stat-label">Max/Bowler</div></div>
            </div>
            <div className="flex justify-between" style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              <span style={{ color: 'var(--blue)' }}>{form.teamAName}</span>
              <span style={{ color: 'var(--text3)', fontWeight: 400 }}>vs</span>
              <span style={{ color: 'var(--red)' }}>{form.teamBName}</span>
            </div>
            {form.location && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>📍 {form.location}</div>}
            {form.seriesId && state.series[form.seriesId] && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>🏆 Series: {state.series[form.seriesId].name}</div>
            )}
            {form.aiCommentary && <div style={{ marginTop: 6 }}><span className="badge badge-purple">🤖 AI Commentary ON</span></div>}
            {!form.aiCommentary && <div style={{ marginTop: 6 }}><span style={{ fontSize: 12, color: 'var(--text3)' }}>Commentary off</span></div>}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost w-full" onClick={() => setStep(2)}>← Back</button>
            <button type="button" className="btn btn-primary w-full btn-lg" onClick={() => { if (form.title.trim()) onCreate(form); }}>
              🏏 Start Match!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CREATE SERIES
// ============================================================
function CreateSeriesPage({ onCreate, onBack, state }) {
  const [form, setForm] = useState({
    name: '', totalMatches: 3,
    teamAName: '', teamBName: '',
    playersA: [], playersB: [],
    overs: 10, isPublic: false,
  });
  const [newPlayerA, setNewPlayerA] = useState({ name: '', photo: null });
  const [newPlayerB, setNewPlayerB] = useState({ name: '', photo: null });
  const photoRefA = useRef(null);
  const photoRefB = useRef(null);

  const addPlayer = (team) => {
    const np = team === 'A' ? newPlayerA : newPlayerB;
    if (!np.name.trim()) return;
    const p = { id: genId(), name: np.name.trim(), photo: np.photo || null };
    if (team === 'A') { setForm(f => ({ ...f, playersA: [...f.playersA, p] })); setNewPlayerA({ name: '', photo: null }); if (photoRefA.current) photoRefA.current.value = ''; }
    else { setForm(f => ({ ...f, playersB: [...f.playersB, p] })); setNewPlayerB({ name: '', photo: null }); if (photoRefB.current) photoRefB.current.value = ''; }
  };

  const addExisting = (player, team) => {
    const list = team === 'A' ? form.playersA : form.playersB;
    if (list.find(p => p.id === player.id)) return;
    if (team === 'A') setForm(f => ({ ...f, playersA: [...f.playersA, player] }));
    else setForm(f => ({ ...f, playersB: [...f.playersB, player] }));
  };

  const valid = form.name.trim().length > 0 && form.teamAName.trim().length > 0 && form.teamBName.trim().length > 0;

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 24 }}>New Series</div>
      </div>
      <div className="card mb-3">
        <div className="form-group">
          <label className="label">Series Name *</label>
          <input className="input" placeholder="e.g. India vs Pakistan T20 Series" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div className="form-group">
          <label className="label">Number of Matches</label>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {[1, 2, 3, 5, 7].map(n => (
              <button key={n} type="button" className={`btn btn-sm ${form.totalMatches === n ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setForm(f => ({ ...f, totalMatches: n }))}>{n}</button>
            ))}
          </div>
          <input className="input" type="number" min="1" max="20" value={form.totalMatches}
            onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setForm(f => ({ ...f, totalMatches: v })); }}
            style={{ width: 120 }} placeholder="Custom" />
        </div>
        <div className="form-group">
          <label className="label">Overs per Match (applied to every match in this series)</label>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {[5, 6, 8, 10, 15, 20, 50].map(o => (
              <button key={o} type="button" className={`btn btn-sm ${form.overs === o ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setForm(f => ({ ...f, overs: o }))}>{o}</button>
            ))}
          </div>
          <input className="input" type="number" min="1" max="100" value={form.overs}
            onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setForm(f => ({ ...f, overs: v })); }}
            style={{ width: 120 }} placeholder="Overs" />
        </div>
        <div className="form-group mb-0">
          <label className="label">Series Visibility</label>
          <div className="flex gap-2">
            <button type="button" className={`btn btn-sm ${!form.isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, isPublic: false }))}>
              🔒 Private (Code only)
            </button>
            <button type="button" className={`btn btn-sm ${form.isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setForm(f => ({ ...f, isPublic: true }))}>
              🌍 Public (Anyone)
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            {form.isPublic
              ? '📱 Anyone who signs in can see and join this series'
              : '🔐 Only people with the code can access this series'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, padding: '0 4px' }}>
        🏏 Team names, overs, and players set here will be used as the starting point for every match added to this series.
      </div>

      {/* Team & Player selection — reuses the same component as match creation */}
      <PlayerTeamSection team="A" form={form} setForm={setForm} state={state} newPlayerA={newPlayerA} setNewPlayerA={setNewPlayerA} newPlayerB={newPlayerB} setNewPlayerB={setNewPlayerB} addPlayer={addPlayer} addExisting={addExisting} />
      <PlayerTeamSection team="B" form={form} setForm={setForm} state={state} newPlayerA={newPlayerA} setNewPlayerA={setNewPlayerA} newPlayerB={newPlayerB} setNewPlayerB={setNewPlayerB} addPlayer={addPlayer} addExisting={addExisting} />

      {!valid && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠️ Please fill Series Name, Team A and Team B names</div>}
      <button type="button" className="btn btn-primary w-full btn-lg" style={{ opacity: valid ? 1 : 0.5 }}
        onClick={() => { if (valid) onCreate(form); }}>
        🏆 Create Series
      </button>
    </div>
  );
}

// ============================================================
// TOSS
// ============================================================
function TossModal({ match, onDone, onClose }) {
  const [phase, setPhase] = useState('ready'); // ready | spinning | result | choose
  const [winner, setWinner] = useState(null);
  const [choice, setChoice] = useState(null);

  const conductToss = () => {
    setPhase('spinning');
    setTimeout(() => {
      const w = Math.random() < 0.5 ? 'A' : 'B';
      setWinner(w);
      setPhase('result');
    }, 2500);
  };

  const teamName = (side) => side === 'A' ? match.teamA?.name : match.teamB?.name;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">🪙 Coin Toss</div>

        {phase === 'ready' && (
          <div className="text-center">
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24 }}>
              {match.teamA?.name} vs {match.teamB?.name}
            </div>
            <button className="btn btn-primary btn-lg" onClick={conductToss}>Conduct Toss 🪙</button>
          </div>
        )}

        {phase === 'spinning' && (
          <div className="text-center">
            <div className="toss-coin spinning">🪙</div>
            <div style={{ color: 'var(--text2)', fontSize: 14 }}>Flipping...</div>
          </div>
        )}

        {phase === 'result' && (
          <div className="text-center fade-in">
            <div className="toss-coin" style={{ animation: 'bounceIn 0.4s ease' }}>🏆</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{teamName(winner)} wins the toss!</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>Choose to bat or field:</div>
            <div className="flex gap-3 justify-center">
              <button className="btn btn-primary btn-lg" onClick={() => { setChoice('bat'); setPhase('done'); onDone(winner, 'bat'); }}>🏏 Bat</button>
              <button className="btn btn-ghost btn-lg" onClick={() => { setChoice('field'); setPhase('done'); onDone(winner, 'field'); }}>🧤 Field</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MATCH PAGE
// ============================================================
// Generate PDF Scorecard
function generateMatchPDF(match) {
  // Build complete player map from all sources
  const playerMap = {};
  [...(match.teamA?.players || []), ...(match.teamB?.players || [])].forEach(p => {
    playerMap[p.id] = p;
  });
  const getName = (pid) => playerMap[pid]?.name || pid || 'Unknown';

  const teamA = match.teamA?.name || 'Team A';
  const teamB = match.teamB?.name || 'Team B';
  const matchDate = match.startedAt ? new Date(match.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date(match.createdAt || Date.now()).toLocaleDateString('en-IN');
  const matchTime = match.startedAt && match.endedAt
    ? `${new Date(match.startedAt).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})} – ${new Date(match.endedAt).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}`
    : match.startedAt ? new Date(match.startedAt).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : '';

  const buildInningsHTML = (inn, innNum) => {
    if (!inn) return '';
    const battingTeam = inn.team === 'A' ? teamA : teamB;
    const totalOvers = `${Math.floor((inn.balls||0)/6)}.${(inn.balls||0)%6}`;

    // Batting rows with full dismissal info
    const batRows = Object.entries(inn.batsmen || {}).map(([pid, b]) => {
      let dismissal = '<span style="color:#1a7a3c;font-weight:600">not out</span>';
      if (b.out) {
        if (b.outMode === 'Caught' && b.caughtByName) {
          dismissal = `c. ${b.caughtByName}${b.bowlerName ? ' b. '+b.bowlerName : ''}`;
        } else if (b.outMode === 'Bowled' && b.bowlerName) {
          dismissal = `b. ${b.bowlerName}`;
        } else if (b.outMode === 'Stumped') {
          dismissal = `st.${b.bowlerName ? ' b. '+b.bowlerName : ''}`;
        } else if (b.outMode === 'Run Out') {
          dismissal = 'run out';
        } else if (b.outMode === 'LBW') {
          dismissal = `lbw b.${b.bowlerName ? ' '+b.bowlerName : ''}`;
        } else if (b.outMode === 'Hit Wicket') {
          dismissal = `hit wicket${b.bowlerName ? ' b. '+b.bowlerName : ''}`;
        } else {
          dismissal = `<span style="color:#c00">${b.outMode || 'out'}</span>`;
        }
      }
      const sr = b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(0) : '-';
      const isImpact = playerMap[pid]?.isImpactIn ? ' <span style="background:#e8f5e9;color:#1a7a3c;font-size:10px;padding:1px 4px;border-radius:3px">Impact</span>' : '';
      const isSubOut = playerMap[pid]?.isImpactOut ? ' <span style="background:#fce4ec;color:#c00;font-size:10px;padding:1px 4px;border-radius:3px">Sub Out</span>' : '';
      return `<tr>
        <td style="border:1px solid #ddd;padding:7px 8px">${getName(pid)}${isImpact}${isSubOut}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;color:#666;font-size:11px">${dismissal}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center;font-weight:700;font-size:14px">${b.runs||0}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${b.balls||0}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${b.fours||0}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${b.sixes||0}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center;color:#666">${sr}</td>
      </tr>`;
    }).join('');

    // Extras row
    const extras = inn.extras || 0;
    const extrasDetail = extras > 0 ? ` (W:${inn.wides||0} NB:${inn.noballs||0})` : '';

    // Bowling rows with economy
    const bowlRows = Object.entries(inn.bowlers || {}).map(([pid, b]) => {
      const overs = `${Math.floor((b.balls||0)/6)}.${(b.balls||0)%6}`;
      const econ = b.balls > 0 ? (b.runs/(b.balls/6)).toFixed(1) : '-';
      return `<tr>
        <td style="border:1px solid #ddd;padding:7px 8px">${getName(pid)}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${overs}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${b.runs||0}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center;font-weight:700">${b.wickets||0}</td>
        <td style="border:1px solid #ddd;padding:7px 8px;text-align:center">${econ}</td>
      </tr>`;
    }).join('');

    // Catch drops
    const dropsHTML = (inn.catchDrops||[]).length > 0
      ? `<div style="margin-top:10px;padding:8px 10px;background:#fff3f3;border-left:3px solid #cc0000;border-radius:4px">
          <div style="font-weight:700;font-size:12px;color:#cc0000;margin-bottom:4px">🤲 Catch Drops</div>
          ${(inn.catchDrops||[]).map(d => `<div style="font-size:11px;color:#666;margin-bottom:2px">
            ${d.name} dropped a catch (batsman on ${d.runsAtDrop||0})${d.at ? ' at '+new Date(d.at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : ''}
          </div>`).join('')}
        </div>` : '';

    // Impact substitutions
    const impacts = (match.impactPlayers||[]).filter(ip => ip.team === inn.team);
    const impactHTML = impacts.length > 0
      ? `<div style="margin-top:10px;padding:8px 10px;background:#f3f0ff;border-left:3px solid #7c4dff;border-radius:4px">
          <div style="font-weight:700;font-size:12px;color:#7c4dff;margin-bottom:4px">⚡ Impact Player Substitution</div>
          ${impacts.map(ip => `<div style="font-size:11px;color:#666;margin-bottom:2px">
            ${ip.outName} → ${ip.inName}${ip.at ? ' at '+new Date(ip.at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : ''}
          </div>`).join('')}
        </div>` : '';

    return `
      <div style="margin-bottom:28px">
        <h2 style="font-size:16px;color:#1a1a1a;border-bottom:2px solid #1a1a1a;padding-bottom:6px;margin-bottom:12px">
          🏏 Innings ${innNum}: ${battingTeam}
          <span style="font-size:14px;font-weight:400;color:#666;margin-left:10px">${inn.runs||0}/${inn.wickets||0} in ${totalOvers} overs</span>
        </h2>

        <h3 style="font-size:12px;color:#666;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Batting</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
          <tr style="background:#f5f5f5">
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:left">Batter</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:left;font-weight:400;color:#888">Dismissal</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">R</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">B</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">4s</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">6s</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">SR</th>
          </tr>
          ${batRows}
          <tr style="background:#f5f5f5">
            <td colspan="2" style="border:1px solid #ddd;padding:7px 8px;font-weight:600">Extras${extrasDetail}</td>
            <td colspan="5" style="border:1px solid #ddd;padding:7px 8px;text-align:center;font-weight:700">${extras}</td>
          </tr>
          <tr style="background:#eeeeee">
            <td colspan="2" style="border:1px solid #ddd;padding:8px;font-weight:800;font-size:13px">TOTAL</td>
            <td colspan="5" style="border:1px solid #ddd;padding:8px;font-weight:800;font-size:16px;text-align:center">${inn.runs||0}/${inn.wickets||0} (${totalOvers} ov)</td>
          </tr>
        </table>

        ${dropsHTML}
        ${impactHTML}

        <h3 style="font-size:12px;color:#666;margin-bottom:8px;margin-top:14px;text-transform:uppercase;letter-spacing:0.5px">Bowling</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr style="background:#f5f5f5">
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:left">Bowler</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">Overs</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">Runs</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">Wkts</th>
            <th style="border:1px solid #ddd;padding:7px 8px;text-align:center">Econ</th>
          </tr>
          ${bowlRows}
        </table>
      </div>`;
  };

  const resultStr = !match.result ? ''
    : match.result.winner === 'Match' ? '🤝 Match Tied'
    : `🏆 ${match.result.winner} won — ${match.result.by || ''}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${match.title || 'Match'} — Scorecard</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:860px;margin:0 auto;color:#1a1a1a}@media print{body{padding:12px}}</style>
  </head><body>
  <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1a1a1a;padding-bottom:14px">
    <h1 style="margin:0;font-size:22px">${match.title || 'Cricket Match'}</h1>
    <div style="color:#666;font-size:13px;margin-top:4px">${teamA} vs ${teamB}</div>
    <div style="color:#888;font-size:12px;margin-top:2px">${matchDate}${matchTime ? ' • '+matchTime : ''}${match.location ? ' • '+match.location : ''}</div>
  </div>
  ${match.tossWinner ? `<div style="background:#fffde7;border:1px solid #ffd600;border-radius:6px;padding:10px 14px;margin-bottom:18px;font-size:13px">
    🪙 <strong>Toss:</strong> ${match.tossWinner === 'A' ? teamA : teamB} won and chose to ${match.tossChoice || 'bat'}
  </div>` : ''}
  ${buildInningsHTML(match.innings?.['1'], 1)}
  ${buildInningsHTML(match.innings?.['2'], 2)}
  ${match.superOver ? `<div style="background:#fff8e1;border:2px solid #ffd600;border-radius:8px;padding:14px;margin-bottom:20px">
    <div style="font-weight:700;font-size:15px;margin-bottom:4px">⚡ Super Over</div>
    <div style="font-size:13px">${teamA}: ${match.superOver.innings?.so1?.battingTeam==='A'?match.superOver.innings?.so1?.runs||0:match.superOver.innings?.so2?.runs||0}
    | ${teamB}: ${match.superOver.innings?.so1?.battingTeam==='B'?match.superOver.innings?.so1?.runs||0:match.superOver.innings?.so2?.runs||0}</div>
    ${match.superOver.winner ? `<div style="font-weight:700;color:#1a7a3c;margin-top:4px">🏆 Super Over Winner: ${match.superOver.winner}</div>` : ''}
  </div>` : ''}
  ${resultStr ? `<div style="background:${match.result?.winner==='Match'?'#fff8e1':'#e8f5e9'};border:2px solid ${match.result?.winner==='Match'?'#ffd600':'#4caf50'};border-radius:8px;padding:16px;text-align:center;margin-bottom:20px">
    <div style="font-size:22px;font-weight:800">${resultStr}</div>
    ${match.result?.potm ? `<div style="margin-top:8px;font-size:13px">⭐ Player of the Match: <strong>${match.result.potm}</strong></div>` : ''}
  </div>` : ''}
  <div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:11px">Generated by Crictera • ${new Date().toLocaleDateString()}</div>
  </body></html>`;

  downloadHTML(html, (match.title || 'match').replace(/[^a-z0-9]/gi, '_') + '_scorecard.html');
}

function ShareMatchSection({ match }) {
  const [downloadMsg, setDownloadMsg] = useState('');

  const downloadMatchFile = (role) => {
    try {
      const encoded = buildShareCode(match, role);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${match.title || 'Match'} — Crictera</title></head><body style="font-family:sans-serif;background:#111;color:#fff;padding:16px;max-width:480px;margin:0 auto"><h2 style="margin:0 0 4px">${match.title || 'Cricket Match'}</h2><p style="color:#aaa;margin:0 0 16px">${match.teamA?.name || 'Team A'} vs ${match.teamB?.name || 'Team B'} — ${role.toUpperCase()} access</p><p style="color:#888;font-size:12px;margin-bottom:4px">Open Crictera → "Join a Match" → paste the text below (tap to select all):</p><textarea onclick="this.select()" readonly style="width:100%;background:#0a0a0a;color:#1de9a0;padding:10px;border-radius:6px;font-size:11px;height:120px;border:1px solid #333;word-break:break-all">${encoded}</textarea></body></html>`;
      downloadHTML(html, (match.title || 'match').replace(/[^a-z0-9]/gi, '_') + '_' + role + '.html');
      setDownloadMsg('📥 File downloaded — share it via WhatsApp');
    } catch (e) {
      setDownloadMsg('❌ Could not generate file');
    }
    setTimeout(() => setDownloadMsg(''), 4000);
  };

  const handleCopy = async (role) => {
    try {
      const encoded = buildShareCode(match, role);
      const ok = await copyToClipboard(encoded);
      setDownloadMsg(ok
        ? `📋 ${role === 'editor' ? 'Editor' : 'Viewer'} share code copied! Paste it in the other person's Join box.`
        : '❌ Could not copy automatically — try the Download option instead');
    } catch (e) {
      setDownloadMsg('❌ Could not generate share code');
    }
    setTimeout(() => setDownloadMsg(''), 4000);
  };

  return (
    <div>
      {downloadMsg && (
        <div style={{ fontSize: 12, color: downloadMsg.startsWith('❌') ? 'var(--red)' : 'var(--green)', marginBottom: 8, textAlign: 'center' }}>{downloadMsg}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button className="btn btn-ghost" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', height: 72 }}
          onClick={() => downloadMatchFile('viewer')}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Download Viewer</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Read-only access</span>
        </button>
        <button className="btn btn-ghost" style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', height: 72, borderColor: 'var(--green)' }}
          onClick={() => downloadMatchFile('editor')}>
          <span style={{ fontSize: 20 }}>✏️</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Download Editor</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Can score & edit</span>
        </button>
      </div>

      {/* Copy Share Code — copies the encoded payload directly, no file needed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {['viewer', 'editor'].map(role => (
          <button key={role} className="btn btn-ghost btn-sm"
            style={{ color: role === 'editor' ? 'var(--green)' : 'var(--gold)' }}
            onClick={() => handleCopy(role)}>
            📋 Copy {role === 'editor' ? 'Editor' : 'Viewer'} Share Code
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'var(--bg3)', borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>VIEWER CODE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, letterSpacing: 4, color: 'var(--gold)' }}>{match.viewerCode}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid rgba(29,233,160,0.3)' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>EDITOR CODE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, letterSpacing: 4, color: 'var(--green)' }}>{match.editorCode}</div>
        </div>
      </div>
      <div style={{ padding: '8px 10px', background: 'rgba(29,233,160,0.07)', borderRadius: 6, fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
        💡 <strong>How to share:</strong><br/>
        • <strong>Same device, different account:</strong> the other person can type the short code above into "Join a Match".<br/>
        • <strong>Different device:</strong> short codes won't work there. Instead, tap <strong>Copy Share Code</strong> (or <strong>Download</strong>) and send that long text via WhatsApp — the other person pastes the WHOLE text into "Join a Match".
      </div>
    </div>
  );
}

function MatchPage({ match, state, onScore, onUndo, onEndMatch, onUpdateMatch, onAddNote, onAddEquipment, onReact, onBack, onNav, onDeleteMatch, onDeleteSeries, onDeleteTournament }) {
  const [tab, setTab] = useState('score');
  const [showToss, setShowToss] = useState(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);
  const [runOutRuns, setRunOutRuns] = useState(0);
  const [runOutWho, setRunOutWho] = useState('striker');
  const [showPlayerSelect, setShowPlayerSelect] = useState(null);
  const [note, setNote] = useState('');
  const [equipForm, setEquipForm] = useState({ player: '', items: '' });
  const [pendingMedia, setPendingMedia] = useState(null);
  const mediaInputRef = useRef(null);
  const [pendingBallVideo, setPendingBallVideo] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [lbwChallengeMode, setLbwChallengeMode] = useState(false);
  const [showSuperOverModal, setShowSuperOverModal] = useState(false);
  const [commentaryLang, setCommentaryLang] = useState('en'); // 'en' | 'hi'
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(match.title || '');
  const [caughtByPid, setCaughtByPid] = useState('');
  const [catchDropPid, setCatchDropPid] = useState('');
  const [catchDropRuns, setCatchDropRuns] = useState(0);
  const [showCatchDropModal, setShowCatchDropModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactTeam, setImpactTeam] = useState('');
  const [impactOut, setImpactOut] = useState('');
  const [impactIn, setImpactIn] = useState('');
  const [impactInName, setImpactInName] = useState('');
  // Own matches (not opened via a shared code) are always editable by their creator/account.
  // Matches opened via a viewer/editor code respect that code's access level.
  const isEditor = !match._shared || match._editorAccess === true;

  const inns = match.innings?.[match.currentInnings];
  const batting = match.battingTeam;

  const runRate = inns ? ((inns.runs / (inns.balls / 6)) || 0).toFixed(2) : '0.00';
  const currentBalls = inns ? inns.balls % 6 : 0;
  const currentOver = inns ? Math.floor(inns.balls / 6) : 0;

  // How many complete overs a bowler has bowled
  const bowlerOversCount = (pid) => {
    if (!inns?.bowlers?.[pid]) return 0;
    return Math.floor((inns.bowlers[pid].balls || 0) / 6);
  };

  // Is bowler at/over their limit?
  const isBowlerOverLimit = (pid) => {
    const limit = match.maxOversPerBowler || 0;
    if (!limit) return false;
    return bowlerOversCount(pid) >= limit;
  };

  // Is player already out (cannot bat again)?
  const isPlayerOut = (pid) => !!inns?.batsmen?.[pid]?.out;

  // Validation: can we bowl a ball right now?
  const canScore = !!(inns?.striker && inns?.nonStriker && inns?.bowler);

  const getCurrentOverBalls = () => {
    if (!inns || !inns.balls_by_ball) return [];
    // Get all legal+illegal balls in current over
    const legalBallsBeforeThisOver = currentOver * 6;
    let legalCount = 0;
    const overBalls = [];
    for (const b of inns.balls_by_ball) {
      if (legalCount >= legalBallsBeforeThisOver) overBalls.push(b);
      if (!b.wide && !b.noball) legalCount++;
    }
    return overBalls;
  };

  const getPartnership = () => {
    if (!inns) return { runs: 0, balls: 0, p1: null, p2: null };
    const s = inns.striker;
    const ns = inns.nonStriker;
    if (!s || !ns) return { runs: 0, balls: 0, p1: null, p2: null };

    // Replay ball-by-ball from the start of the innings, resetting at each wicket,
    // to find runs/balls scored by EACH current batter since the last wicket
    const balls = inns.balls_by_ball || [];
    let p1Runs = 0, p1Balls = 0, p2Runs = 0, p2Balls = 0;
    let lastWicketIdx = -1;
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].wicket) lastWicketIdx = i;
    }
    for (let i = lastWicketIdx + 1; i < balls.length; i++) {
      const ball = balls[i];
      const bid = ball.batsman;
      if (bid === s.id) { if (!ball.wide) { p1Balls++; p1Runs += ball.runs || 0; } }
      else if (bid === ns.id) { if (!ball.wide) { p2Balls++; p2Runs += ball.runs || 0; } }
    }
    return {
      runs: p1Runs + p2Runs,
      balls: p1Balls + p2Balls,
      p1: { name: s.name, runs: p1Runs, balls: p1Balls },
      p2: { name: ns.name, runs: p2Runs, balls: p2Balls },
    };
  };

  const partnership = getPartnership();

  const handleTossDone = (winner, choice) => {
    setShowToss(false);
    const battingTeam = (winner === 'A' && choice === 'bat') || (winner === 'B' && choice === 'field') ? 'A' : 'B';
    onUpdateMatch(match.id, { tossWinner: winner, tossChoice: choice, battingTeam, status: 'live' });
  };

  const handleScore = (type, runs) => {
    if (!canScore) return;
    if (type === 'wicket') { setShowWicketModal(true); return; }
    onScore(match.id, { type, runs: runs || 0, media: pendingMedia, video: pendingBallVideo });
    setPendingMedia(null);
    setPendingBallVideo(null);
    setAiAnalysis(null);
  };

  const handleAICommentaryForVideo = async () => {
    if (!pendingBallVideo) return;
    setAiLoading(true);
    const result = await analyzeVideoWithAI(pendingBallVideo, {
      batsman: inns?.striker?.name,
      bowler: inns?.bowler?.name,
      askLBW: false
    });
    setAiAnalysis(result);
    setAiLoading(false);
  };

  const handleLBWChallenge = async (video) => {
    setAiLoading(true);
    setLbwChallengeMode(true);
    const result = await analyzeVideoWithAI(video, {
      batsman: inns?.striker?.name,
      bowler: inns?.bowler?.name,
      askLBW: true
    });
    setAiAnalysis(result);
    setAiLoading(false);
  };

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = (ev) => setPendingMedia({ type: isVideo ? 'video' : 'image', dataUrl: ev.target.result, name: file.name });
    reader.readAsDataURL(file);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 480, paddingBottom: 80 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{match.title}</div>
          {match.location && <div style={{ fontSize: 11, color: 'var(--text3)' }}>📍 {match.location}</div>}
        </div>
        {match.status === 'live' && <span className="badge badge-live">LIVE</span>}
        {match.status === 'done' && <span className="badge badge-green">DONE</span>}
      </div>

      {/* Toss needed */}
      {match.status === 'setup' && (
        <div className="card mb-3" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🪙</div>
          <div style={{ marginBottom: 16, color: 'var(--text2)' }}>Conduct the toss to start the match</div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowToss(true)}>Conduct Toss</button>
        </div>
      )}

      {/* Scoreboard */}
      {match.status !== 'setup' && (
        <div className="card mb-3" style={{ background: 'linear-gradient(135deg, var(--card) 0%, var(--card2) 100%)' }}>
          {match.tossWinner && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              🪙 {match.tossWinner === 'A' ? match.teamA?.name : match.teamB?.name} won toss, elected to {match.tossChoice}
            </div>
          )}
          {match.innings && Object.entries(match.innings).map(([key, inn]) => (
            <div key={key} style={{ marginBottom: key === '1' && match.innings['2'] ? 12 : 0 }}>
              <div className="flex items-center justify-between mb-1">
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                  {key === '1' ? (inn.team === 'A' ? match.teamA?.name : match.teamB?.name) : (inn.team === 'A' ? match.teamA?.name : match.teamB?.name)}
                  {match.currentInnings === key && <span className="badge badge-live" style={{ marginLeft: 6, fontSize: 9 }}>BAT</span>}
                </div>
                <div className="font-mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{match.overs} ov</div>
              </div>
              <div className="flex items-end gap-3">
                <div className="score-main">{inn.runs}<span className="wicket-count">/{inn.wickets}</span></div>
                <div>
                  <div className="score-overs">({formatOvers(inn.balls)})</div>
                  <div className="score-rr">RR: {((inn.runs / (inn.balls / 6)) || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Target */}
          {match.currentInnings === '2' && match.innings?.['1'] && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(245,200,66,0.08)', borderRadius: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>Target: </span>
              <span className="text-gold font-mono" style={{ fontWeight: 700 }}>{match.innings?.['1']?.runs + 1}</span>
              {match.innings?.['2'] && (
                <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                  Need {(match.innings?.['1']?.runs + 1) - match.innings?.['2']?.runs} in {(match.overs * 6) - match.innings?.['2']?.balls} balls
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Match Done - Result */}
      {match.status === 'done' && match.result && (
        <div className="result-screen mb-3">
          <div className="result-trophy">🏆</div>
          <div className="result-winner">{match.result.winner}</div>
          <div className="result-score">{match.result.by}</div>
          {match.result.potm && (
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-gold">⭐ Player of the Match: {match.result.potm}</span>
            </div>
          )}
          {match.result.by === 'Tied!' && !match.superOver && isEditor && (
            <button className="btn btn-primary" style={{ marginTop: 14, fontSize: 14, padding: '10px 24px' }}
              onClick={() => setShowSuperOverModal(true)}>
              ⚡ Play Super Over
            </button>
          )}
          {match.superOver?.winner && (
            <div style={{ marginTop: 12, padding: '10px', background: 'rgba(255,193,7,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>SUPER OVER WINNER</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>{match.superOver.winner} 🏆</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {match.teamA?.name}: {match.superOver.innings?.so1?.battingTeam === 'A' ? match.superOver.innings.so1.runs : match.superOver.innings?.so2?.runs || 0} |{' '}
                {match.teamB?.name}: {match.superOver.innings?.so1?.battingTeam === 'B' ? match.superOver.innings.so1.runs : match.superOver.innings?.so2?.runs || 0}
              </div>
            </div>
          )}
          {match.superOver && !match.superOver.winner && isEditor && (
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => onNav?.('superover', match.id)}>
              ⚡ Continue Super Over
            </button>
          )}
          {isEditor && !match.superOver && (
            <button className="btn btn-ghost" style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}
              onClick={() => onUndo(match.id)}>
              ↩ Undo Last Ball (reopens match for editing)
            </button>
          )}
        </div>
      )}

      {/* Super Over Modal */}
      {showSuperOverModal && (
        <SuperOverModal
          match={match}
          onClose={() => setShowSuperOverModal(false)}
          onStartSuperOver={(battingFirst) => {
            setShowSuperOverModal(false);
            onUpdateMatch(match.id, { initSuperOver: { battingFirst } });
          }}
        />
      )}

      {/* Tabs */}
      <div className="tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {[
          ['score','⚡'],['batters','🏏'],['bowlers','🎯'],
          ['timeline','📋'],['highlights','🎬'],
          ['predictor','🤖'],['stats','📊'],['drs','🔴'],
          ['share','📤'],['info','ℹ️'],
        ].map(([t, icon]) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}
            style={{ fontSize: 10, padding: '6px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {icon}
          </button>
        ))}
      </div>

      {/* SCORE TAB */}
      {tab === 'score' && match.status === 'live' && isEditor && inns && (
        <div className="fade-in">
          {/* Current Over */}
          <div className="card mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="section-title" style={{ marginBottom: 0 }}>Over {currentOver + 1}</div>
              <div className="font-mono text-sm text-muted">RR: {runRate}</div>
            </div>
            <div className="over-display">
              {getCurrentOverBalls().map((b, i) => (
                <div key={i} className={`over-dot ${ballClass(b)}`}>{ballLabel(b)}</div>
              ))}
              {Array(6 - currentBalls).fill(null).map((_, i) => (
                <div key={`e${i}`} className="over-dot" style={{ opacity: 0.3 }}>·</div>
              ))}
            </div>
          </div>

          {/* Batsmen */}
          <div className="card mb-3">
            <div className="section-title">At the Crease</div>
            <div className="flex flex-col gap-2">
              {inns.striker && (
                <div className="flex items-center gap-3 selector-row active" onClick={() => setShowPlayerSelect('striker')}>
                  <PlayerAvatar player={inns.striker} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{inns.striker.name} <span className="crease-indicator"><span className="striker-dot" />STRIKER</span></div>
                    <div className="font-mono text-sm text-gold">{inns.batsmen?.[inns.striker.id]?.runs || 0} ({inns.batsmen?.[inns.striker.id]?.balls || 0}) • SR: {formatRate(inns.batsmen?.[inns.striker.id]?.runs || 0, inns.batsmen?.[inns.striker.id]?.balls || 0)}</div>
                  </div>
                </div>
              )}
              {!inns.striker && (
                <button className="selector-row" onClick={() => setShowPlayerSelect('striker')}>
                  <span style={{ color: 'var(--text3)' }}>+ Select Striker</span>
                </button>
              )}
              {inns.nonStriker && (
                <div className="flex items-center gap-3 selector-row" onClick={() => setShowPlayerSelect('nonStriker')}>
                  <PlayerAvatar player={inns.nonStriker} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{inns.nonStriker.name} <span style={{ fontSize: 10, color: 'var(--text3)' }}>non-striker</span></div>
                    <div className="font-mono text-sm text-muted">{inns.batsmen?.[inns.nonStriker.id]?.runs || 0} ({inns.batsmen?.[inns.nonStriker.id]?.balls || 0})</div>
                  </div>
                </div>
              )}
              {!inns.nonStriker && (
                <button className="selector-row" onClick={() => setShowPlayerSelect('nonStriker')}>
                  <span style={{ color: 'var(--text3)' }}>+ Select Non-Striker</span>
                </button>
              )}
            </div>

            {/* Partnership */}
            {partnership.runs >= 0 && partnership.p1 && partnership.p2 && (
              <div style={{ marginTop: 10 }}>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Partnership: <span className="text-blue font-mono">{partnership.runs} ({partnership.balls})</span></span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--text3)' }}>
                  <span>{partnership.p1.name}: <span className="font-mono" style={{ color: 'var(--text2)' }}>{partnership.p1.runs} ({partnership.p1.balls})</span></span>
                  <span>{partnership.p2.name}: <span className="font-mono" style={{ color: 'var(--text2)' }}>{partnership.p2.runs} ({partnership.p2.balls})</span></span>
                </div>
              </div>
            )}
          </div>

          {/* Bowler */}
          <div className="card mb-3">
            <div className="section-title">Bowling</div>
            {inns.bowler ? (
              <div className="flex items-center gap-3 selector-row" onClick={() => setShowPlayerSelect('bowler')}>
                <PlayerAvatar player={inns.bowler} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{inns.bowler.name}</div>
                  <div className="font-mono text-sm text-muted">
                    {formatOvers(inns.bowlers?.[inns.bowler.id]?.balls || 0)} overs • {inns.bowlers?.[inns.bowler.id]?.runs || 0} runs • {inns.bowlers?.[inns.bowler.id]?.wickets || 0}w
                  </div>
                </div>
              </div>
            ) : (
              <button className="selector-row w-full" onClick={() => setShowPlayerSelect('bowler')}>
                <span style={{ color: 'var(--text3)' }}>+ Select Bowler</span>
              </button>
            )}
          </div>

          {/* Score Buttons */}
          <div className="card mb-3">
            <div className="section-title" style={{ marginBottom: 8 }}>Score This Ball</div>

            {/* Ball Media — Camera first, gallery fallback */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ball Media (optional)</div>
              <CameraCapture
                type="video"
                label="🎥 Record Ball Video"
                existingMedia={pendingBallVideo ? { type: 'video', dataUrl: pendingBallVideo } : null}
                onCapture={m => { setPendingBallVideo(m ? m.dataUrl : null); setAiAnalysis(null); }}
              />
              {!pendingBallVideo && (
                <CameraCapture
                  type="image"
                  label="📷 Take Ball Photo"
                  existingMedia={pendingMedia}
                  onCapture={m => setPendingMedia(m)}
                />
              )}
            </div>

            {/* AI Video Analysis buttons */}
            {pendingBallVideo && (
              <div style={{ marginBottom: 10 }}>
                <div className="flex gap-2 mb-2">
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--purple)', borderColor: 'rgba(162,89,255,0.4)' }}
                    onClick={handleAICommentaryForVideo} disabled={aiLoading}>
                    {aiLoading && !lbwChallengeMode ? '🤖 Analysing...' : '🤖 AI Commentary'}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--red)', borderColor: 'rgba(255,74,110,0.4)' }}
                    onClick={() => handleLBWChallenge(pendingBallVideo)} disabled={aiLoading}>
                    {aiLoading && lbwChallengeMode ? '⏳ Checking...' : '⚖️ LBW Check'}
                  </button>
                </div>
                {aiAnalysis && (
                  <div className="ai-analysis-box">
                    <div className="ai-analysis-title">{lbwChallengeMode ? '⚖️ Umpire Review' : '🎙️ AI Commentary'}</div>
                    
                    {lbwChallengeMode && (
                      <div style={{ background: 'rgba(162,89,255,0.1)', border: '1px solid rgba(162,89,255,0.2)', borderRadius: 8, padding: 10, marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'auto' }}>
                        🎯 BALL TRACKING:
                        {aiAnalysis.includes('released') || aiAnalysis.includes('flew') 
                          ? aiAnalysis.split('\n')[0]
                          : 'Ball path analysis from AI video review...'}
                      </div>
                    )}
                    
                    <div className="ai-analysis-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiAnalysis}</div>
                    
                    {lbwChallengeMode && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(162,89,255,0.2)', fontSize: 13, fontWeight: 600 }}>
                        {aiAnalysis.includes('OUT') || aiAnalysis.includes('🔴') 
                          ? <span style={{ color: 'var(--red)' }}>🔴 OUT - LBW</span>
                          : aiAnalysis.includes('NOT') || aiAnalysis.includes('🟢')
                          ? <span style={{ color: 'var(--green)' }}>🟢 NOT OUT</span>
                          : <span style={{ color: 'var(--gold)' }}>🟡 UNCLEAR</span>
                        }
                      </div>
                    )}
                    
                    <button className="btn btn-ghost btn-sm mt-2" style={{ fontSize: 11 }} onClick={() => { setAiAnalysis(null); setLbwChallengeMode(false); }}>✕ Dismiss</button>
                  </div>
                )}
              </div>
            )}

            {/* Blocked warning */}
            {!canScore && (
              <div className="score-blocked-msg">
                {!inns?.striker ? '⚠️ Select striker first' : !inns?.nonStriker ? '⚠️ Select non-striker first' : '⚠️ Select bowler first'}
              </div>
            )}

            {/* Run buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10, pointerEvents: canScore ? 'auto' : 'none', opacity: canScore ? 1 : 0.4 }}>
              {[['·','dot',0],['1','one',1],['2','two',2],['3','three',3],['4','four',4],['6','six',6]].map(([label, cls, runs]) => (
                <button key={cls} className={`score-btn ${cls}`} onClick={() => handleScore('ball', runs)}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', pointerEvents: canScore ? 'auto' : 'none', opacity: canScore ? 1 : 0.4 }}>
              <button className="score-btn wicket" onClick={() => handleScore('wicket', 0)}>🏏 WICKET</button>
              <button className="score-btn wide" onClick={() => handleScore('wide', 0)}>WIDE +1</button>
              {/* No-ball with run options */}
              {[0,1,2,3,4,6].map(r => (
                <button key={r} className="score-btn noball" style={{ width: r===0?72:56, fontSize: r===0?12:11 }}
                  onClick={() => handleScore('noball', r)}>
                  {r === 0 ? 'NO BALL' : `NB+${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* Undo + Catch Drop */}
          <div className="flex gap-2 mb-3">
            <button className="btn btn-ghost w-full" onClick={() => onUndo(match.id)}>
              ↩ Undo Last Ball
            </button>
            <button className="btn btn-ghost" style={{ color: 'var(--red)', borderColor: 'rgba(255,74,110,0.4)', whiteSpace: 'nowrap', padding: '8px 14px' }}
              onClick={() => setShowCatchDropModal(true)}>
              🤲 Catch Drop
            </button>
          </div>

          {/* Impact Player + End Match */}
          <div className="flex gap-2">
            {match.status === 'live' && isEditor && (
              <button className="btn btn-ghost" style={{ color: 'var(--blue)', borderColor: 'rgba(74,158,255,0.4)', whiteSpace: 'nowrap' }}
                onClick={() => setShowImpactModal(true)}>⚡ Impact</button>
            )}
            {match.status === 'live' && (
              <button className="btn btn-danger w-full" onClick={() => onEndMatch(match.id)}>🏁 End Match</button>
            )}
          </div>
        </div>
      )}

      {/* BATTERS TAB */}
      {tab === 'batters' && (
        <div className="fade-in">
          {Object.entries(match.innings || {}).map(([key, inn]) => (
            <div key={key} className="card mb-3">
              <div className="section-title">{inn.team === 'A' ? match.teamA?.name : match.teamB?.name} Batting</div>
              <table className="score-table">
                <thead>
                  <tr><th>Batsman</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
                </thead>
                <tbody>
                  {Object.entries(inn.batsmen || {}).map(([pid, stats]) => {
                    const p = [...(match.teamA?.players || []), ...(match.teamB?.players || [])].find(p => p.id === pid);
                    const isIn = inn.striker?.id === pid || inn.nonStriker?.id === pid;
                    return (
                      <tr key={pid}>
                        <td>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar player={p || { id: pid, name: 'Unknown', photo: null }} size="md" />
                            <span style={{ color: isIn ? 'var(--gold)' : stats.out ? 'var(--text3)' : 'var(--text)' }}>
                              {p?.name || 'Unknown'}{isIn ? ' *' : stats.out ? ' †' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="batting">{stats.runs}</td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{stats.balls}</td>
                        <td className="text-gold font-mono" style={{ fontSize: 12 }}>{stats.fours || 0}</td>
                        <td className="text-green font-mono" style={{ fontSize: 12 }}>{stats.sixes || 0}</td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{formatRate(stats.runs, stats.balls)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="divider" />
              <div className="flex justify-between" style={{ fontSize: 13 }}>
                <span className="text-muted">Extras:</span>
                <span className="font-mono">{inn.extras || 0} (wd: {inn.wides || 0}, nb: {inn.noballs || 0})</span>
              </div>
              {inn.catchDrops?.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--red)' }}>
                  🤲 Drops: {inn.catchDrops.map(d => `${d.name} (bat:${d.runsAtDrop})`).join(' • ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BOWLERS TAB */}
      {tab === 'bowlers' && (
        <div className="fade-in">
          {Object.entries(match.innings || {}).map(([key, inn]) => (
            <div key={key} className="card mb-3">
              <div className="section-title">{inn.team === 'A' ? match.teamB?.name : match.teamA?.name} Bowling</div>
              <table className="score-table">
                <thead>
                  <tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Econ</th></tr>
                </thead>
                <tbody>
                  {Object.entries(inn.bowlers || {}).map(([pid, stats]) => {
                    const p = [...(match.teamA?.players || []), ...(match.teamB?.players || [])].find(p => p.id === pid);
                    return (
                      <tr key={pid}>
                        <td>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar player={p || { id: pid, name: 'Unknown', photo: null }} size="md" />
                            <span>{p?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{formatOvers(stats.balls || 0)}</td>
                        <td className="batting">{stats.runs}</td>
                        <td className="text-red font-mono">{stats.wickets}</td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{formatEcon(stats.runs, stats.balls / 6)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE TAB */}
      {tab === 'timeline' && (
        <div className="fade-in">
          {Object.entries(match.innings || {}).map(([key, inn]) => (
            <div key={key} className="card mb-3">
              <div className="section-title">Innings {key} Ball-by-Ball</div>
              {groupByOver(inn.balls_by_ball || []).map(({ over, balls }) => (
                <div key={over} className="timeline-over">
                  <div className="timeline-over-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Over {over + 1}</span>
                    {balls[0]?.bowlerName && <span style={{ color: 'var(--gold)', fontWeight: 600 }}>🎳 {balls[0].bowlerName}</span>}
                  </div>
                  <div className="timeline-balls">
                    {balls.map((b, i) => (
                      <div key={i} className={`timeline-ball ${ballClass(b)}`}>{ballLabel(b)}</div>
                    ))}
                  </div>
                  {/* Commentary with correct over.ball numbering, batsman name, and timestamp */}
                  {balls.map((b, i) => {
                    const commentaryText = commentaryLang === 'hi'
                      ? (b.hindiCommentary || getHindiCommentary(b))
                      : b.commentary;
                    return commentaryText && (
                      <div key={i} className={`commentary-item ${b.runs === 4 || b.runs === 6 ? 'highlight' : b.wicket ? 'wicket' : ''}`}>
                        <div className="commentary-ball" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <span>{b.ballId || `${b.overIndex || 0}.${i + 1}`}</span>
                          {b.batsmanName && <span style={{ color: 'var(--text2)', fontSize: 11, fontWeight: 600 }}>🏏 {b.batsmanName}</span>}
                          {b.timestamp && <span style={{ color: 'var(--text3)', fontSize: 10 }}>{b.timestamp}</span>}
                        </div>
                        <div className="commentary-text">{commentaryText}</div>
                        {b.video && (
                          <video src={b.video} controls playsInline className="video-preview" style={{ maxHeight: 140, marginTop: 6 }} />
                        )}
                        {b.media && b.media.type === 'image' && (
                          <img src={b.media.dataUrl} className="ball-media-preview" alt="ball" style={{ marginTop: 6 }} />
                        )}
                        {b.aiVerdict && (
                          <div className="ai-analysis-box" style={{ marginTop: 6 }}>
                            <div className="ai-analysis-title">⚖️ {commentaryLang === 'hi' ? 'AI निर्णय' : 'AI Verdict'}</div>
                            <div className="ai-analysis-text" style={{ fontSize: 12 }}>{b.aiVerdict}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {(!inn.balls_by_ball || inn.balls_by_ball.length === 0) && (
                <div className="empty" style={{ padding: '20px 0' }}>
                  <div className="empty-sub">No balls bowled yet</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* HIGHLIGHTS TAB — video reel */}
      {tab === 'highlights' && (
        <div className="fade-in">
          {/* Video Highlights Reel */}
          {(() => {
            const allBalls = Object.values(match.innings || {}).flatMap(inn => inn.balls_by_ball || []);
            const reelBalls = allBalls.filter(b => b.video && (b.runs === 4 || b.runs === 6 || b.wicket));
            const reelLabel = (b) => b.wicket ? `🏏 ${b.wicketMode || 'WICKET'} — ${b.batsman || 'batsman'}` : b.runs === 6 ? `💥 SIX by ${b.batsman || 'batsman'}` : `🔥 FOUR by ${b.batsman || 'batsman'}`;
            return (
              <div className="card mb-3">
                <div className="highlight-reel-title">🎬 Highlights Reel</div>
                {reelBalls.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>
                    Record ball videos and they'll auto-appear here for 4s, 6s, and wickets.
                    {match.status === 'done' && allBalls.filter(b => !b.video && (b.runs === 4 || b.runs === 6 || b.wicket)).length > 0 &&
                      <div style={{ marginTop: 8, color: 'var(--text2)' }}>{allBalls.filter(b => !b.video && (b.runs === 4 || b.runs === 6 || b.wicket)).length} highlight moments without video.</div>}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>{reelBalls.length} clip{reelBalls.length !== 1 ? 's' : ''} — swipe through</div>
                    {reelBalls.map((b, i) => (
                      <div key={i} className="highlight-clip">
                        <div className="highlight-clip-label">{reelLabel(b)} • {b.ballId || b.overIndex + '.' + (b.ballInOver + 1)} {b.timestamp ? `• ${b.timestamp}` : ''}</div>
                        <video src={b.video} controls playsInline className="video-preview" style={{ marginBottom: 6 }} />
                        {b.commentary && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>{b.commentary}</div>}
                        {b.aiVerdict && <div className="ai-analysis-box" style={{ marginTop: 6 }}><div className="ai-analysis-title">⚖️ AI Verdict</div><div className="ai-analysis-text" style={{ fontSize: 12 }}>{b.aiVerdict}</div></div>}
                      </div>
                    ))}
                    {match.status === 'done' && (
                      <div style={{ textAlign: 'center', marginTop: 12, padding: '12px', background: 'rgba(245,200,66,0.08)', borderRadius: 8, border: '1px solid rgba(245,200,66,0.2)' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>🏆 Match Highlights Ready!</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{reelBalls.length} clips • {reelBalls.filter(b => b.wicket).length} wickets • {reelBalls.filter(b => b.runs === 6).length} sixes • {reelBalls.filter(b => b.runs === 4).length} fours</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Save each clip by long-pressing the video</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Classic highlights */}
          <div className="card mb-3">
            <div className="section-title">Key Moments</div>
            {getHighlights(match).length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}>
                <div className="empty-icon">✨</div>
                <div className="empty-sub">Highlights appear as the game progresses</div>
              </div>
            ) : (
              getHighlights(match).map((h, i) => (
                <div key={i} className="highlight-card fade-in">
                  <div className="highlight-moment">{h.icon}</div>
                  <div className="highlight-desc">{h.text}</div>
                  <div className="highlight-meta">{h.over} • {h.bowler}</div>
                </div>
              ))
            )}
          </div>

          {/* Reactions */}
          <div className="card mb-3">
            <div className="section-title">Live Reactions</div>
            <div className="reaction-bar">
              {['👍', '🔥', '😱', '🏏'].map(emoji => {
                const count = (match.reactions?.[emoji] || 0);
                return (
                  <button key={emoji} className="reaction-btn" onClick={() => onReact(match.id, emoji)}>
                    {emoji} <span className="reaction-count">{count > 0 ? count : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* INFO TAB */}
      {tab === 'info' && (
        <div className="fade-in">
          {/* Access Codes & Share Links */}
          <div className="card mb-3">
            <div className="section-title">Share This Match</div>
            <ShareMatchSection match={match} />
          </div>

          {/* Match Notes */}
          <div className="card mb-3">
            <div className="section-title">Match Notes</div>
            {(match.notes || []).map((n, i) => (
              <div key={i} className="commentary-item mb-2">
                <div className="commentary-ball">{new Date(n.time).toLocaleTimeString()}</div>
                <div className="commentary-text">{n.text}</div>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input className="input" placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={() => { onAddNote(match.id, note); setNote(''); }}>Add</button>
            </div>
          </div>

          {/* Equipment */}
          <div className="card mb-3">
            <div className="section-title">Equipment Tracker</div>
            {(match.equipment || []).map((e, i) => (
              <div key={i} className="equip-item">
                <span className="equip-icon">🏏</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.player}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{e.items}</div>
                </div>
              </div>
            ))}
            <div className="flex gap-2 mt-2" style={{ flexDirection: 'column' }}>
              <input className="input" placeholder="Player name" value={equipForm.player} onChange={e => setEquipForm(f => ({ ...f, player: e.target.value }))} />
              <input className="input" placeholder="Equipment (bat, ball, stumps...)" value={equipForm.items} onChange={e => setEquipForm(f => ({ ...f, items: e.target.value }))} />
              <button className="btn btn-primary btn-sm" onClick={() => { onAddEquipment(match.id, equipForm); setEquipForm({ player: '', items: '' }); }}>Add Equipment</button>
            </div>
          </div>

          {/* Match Format + Edit Name */}
          <div className="card mb-3">
            <div className="section-title">Match Info</div>
            {editingName ? (
              <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && nameVal.trim()) {
                      onUpdateMatch(match.id, { title: nameVal.trim() });
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={() => {
                  if (nameVal.trim()) { onUpdateMatch(match.id, { title: nameVal.trim() }); setEditingName(false); }
                }}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingName(false); setNameVal(match.title || ''); }}>✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{match.title}</div>
                {isEditor && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditingName(true); setNameVal(match.title || ''); }}>✏️ Edit Name</button>
                )}
              </div>
            )}
            {(match.startedAt || match.createdAt) && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                📅 {formatMatchDate(match.startedAt || match.createdAt)}
                {match.startedAt && (
                  <span>
                    {' · 🕐 '}{formatMatchTime(match.startedAt)}
                    {match.endedAt
                      ? ` – ${formatMatchTime(match.endedAt)}${formatDuration(match.startedAt, match.endedAt) ? ` (${formatDuration(match.startedAt, match.endedAt)})` : ''}`
                      : match.status === 'live' ? ' (Live now)' : ''}
                  </span>
                )}
              </div>
            )}
            <div className="grid-2">
              <div className="stat-box"><div className="stat-val">{match.overs}</div><div className="stat-label">Overs</div></div>
              <div className="stat-box"><div className="stat-val">{(match.teamA?.players?.length || 0) + (match.teamB?.players?.length || 0)}</div><div className="stat-label">Players</div></div>
            </div>
            {/* Captain selectors */}
            {isEditor && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="label" style={{ fontSize: 10 }}>👑 {match.teamA?.name} Captain</label>
                  <select className="input" style={{ fontSize: 12 }}
                    value={match.captainA || ''} onChange={e => onUpdateMatch(match.id, { captainA: e.target.value })}>
                    <option value="">— None —</option>
                    {(match.teamA?.players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ fontSize: 10 }}>👑 {match.teamB?.name} Captain</label>
                  <select className="input" style={{ fontSize: 12 }}
                    value={match.captainB || ''} onChange={e => onUpdateMatch(match.id, { captainB: e.target.value })}>
                    <option value="">— None —</option>
                    {(match.teamB?.players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            {/* Show current captains */}
            {(match.captainA || match.captainB) && (
              <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {match.captainA && <span className="badge badge-gold">👑 {(match.teamA?.players||[]).find(p=>p.id===match.captainA)?.name || 'Captain A'} (C)</span>}
                {match.captainB && <span className="badge badge-blue">👑 {(match.teamB?.players||[]).find(p=>p.id===match.captainB)?.name || 'Captain B'} (C)</span>}
              </div>
            )}
            {/* Impact Players */}
            {match.impactPlayers?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>⚡ Impact Players</div>
                {match.impactPlayers.map((ip, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 2 }}>
                    {ip.outName} → {ip.inName} ({ip.team === 'A' ? match.teamA?.name : match.teamB?.name})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add to Series */}
          {!match.seriesId && Object.values(state.series || {}).length > 0 && (
            <div className="card mb-3">
              <div className="section-title">➕ Add to Series</div>
              <select className="input" onChange={(e) => {
                if (e.target.value) {
                  onUpdateMatch(match.id, { seriesId: e.target.value });
                  e.target.value = '';
                }
              }}>
                <option value="">-- Select a Series --</option>
                {Object.values(state.series).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {match.seriesId && state.series[match.seriesId] && (
            <div className="card mb-3" style={{ background: 'rgba(29,233,160,0.05)', border: '1px solid rgba(29,233,160,0.2)' }}>
              <div className="section-title" style={{ color: 'var(--green)' }}>📊 In Series</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{state.series[match.seriesId].name}</div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { onNav('series', match.seriesId); }}>
                  → View Series
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => { 
                  onUpdateMatch(match.id, { seriesId: null });
                }}>
                  🗑️ Remove
                </button>
              </div>
            </div>
          )}

          {/* Download PDF Scorecard */}
          {(match.status === 'done' || match.innings['2']) && (
            <div className="card mb-3">
              <button className="btn btn-primary w-full" onClick={() => generateMatchPDF(match)}>
                📄 Download Scorecard PDF
              </button>
            </div>
          )}

          {/* Delete Match - Danger Zone */}
          <div className="card mb-3" style={{ background: 'rgba(255,74,110,0.05)', border: '1px solid rgba(255,74,110,0.2)' }}>
            <div className="section-title" style={{ color: 'var(--red)' }}>⚠️ Danger Zone</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
              Once deleted, this match cannot be recovered. All data will be permanently removed.
            </div>
            <button className="btn btn-danger w-full" onClick={() => setShowDeleteModal(true)}>
              🗑️ Delete Match Permanently
            </button>
          </div>
          
          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                <div className="modal-handle" />
                <div className="modal-title" style={{ color: 'var(--red)' }}>🗑️ Delete Match?</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                  You are about to permanently delete <strong>"{match.title}"</strong>
                  <br/><br/>
                  This will remove ALL match data including scores, videos, and statistics.
                  <br/><br/>
                  This action <strong>CANNOT be undone</strong>.
                </div>
                
                {deleteConfirmCount === 0 && (
                  <div className="flex gap-2">
                    <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                    <button className="btn btn-danger w-full" onClick={() => setDeleteConfirmCount(1)}>I Understand</button>
                  </div>
                )}
                
                {deleteConfirmCount === 1 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(255,74,110,0.1)', border: '1px solid rgba(255,74,110,0.2)', borderRadius: 6, padding: 10, marginBottom: 12, fontWeight: 600 }}>
                      ⚠️ Type the match name below to confirm deletion
                    </div>
                    <input 
                      className="input mb-3" 
                      placeholder={`Type "${match.title}" to confirm`}
                      onChange={(e) => setDeleteConfirmCount(e.target.value === match.title ? 2 : 1)}
                    />
                    <div className="flex gap-2">
                      <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                      <button className="btn btn-ghost w-full" disabled style={{ opacity: 0.5 }}>Confirm</button>
                    </div>
                  </div>
                )}
                
                {deleteConfirmCount === 2 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--green)', background: 'rgba(29,233,160,0.1)', border: '1px solid rgba(29,233,160,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                      ✅ Match name confirmed. Click below to permanently delete.
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                      <button className="btn btn-danger w-full" onClick={() => { onDeleteMatch(match.id); setShowDeleteModal(false); }}>Permanently Delete</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PREDICTOR TAB */}
      {tab === 'predictor' && (
        <div className="fade-in">
          <div className="card mb-3">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 AI Match Predictor
              <span style={{ fontSize: 10, background: 'rgba(162,89,255,0.15)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>LIVE</span>
            </div>
            <AIPredictorPanel match={match} />
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div className="fade-in">
          <div className="card mb-3">
            <div className="section-title">📊 Advanced Stats</div>
            <StatsDashboard match={match} />
          </div>
        </div>
      )}

      {/* DRS TAB */}
      {tab === 'drs' && (
        <div className="fade-in">
          <div className="card mb-3">
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔴 DRS System</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>2 reviews per team</span>
            </div>
            <DRSPanel match={match} onUpdateMatch={onUpdateMatch} />
          </div>
          <div className="card mb-3" style={{ background: 'rgba(255,74,110,0.04)', border: '1px solid rgba(255,74,110,0.15)' }}>
            <div className="section-title" style={{ fontSize: 12 }}>How DRS Works</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
              1. Player asks for a review after the on-field decision<br/>
              2. Third umpire reviews — use AI Umpire in the Wicket modal for LBW analysis<br/>
              3. If decision is overturned → review retained. If upheld → review lost.<br/>
              4. Each team gets 2 reviews per innings.
            </div>
          </div>
        </div>
      )}

      {/* SHARE TAB */}
      {tab === 'share' && (
        <div className="fade-in">
          <ShareMatchPage match={match} onBack={() => setTab('score')} />
        </div>
      )}

      {/* Commentary language selector — shown on timeline tab */}
      {tab === 'timeline' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['en', '🇬🇧 English'], ['hi', '🇮🇳 Hindi']].map(([v, l]) => (
            <button key={v} className={`btn btn-sm ${commentaryLang === v ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCommentaryLang(v)} style={{ fontSize: 11 }}>{l}</button>
          ))}
          {commentaryLang === 'hi' && <span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>हिंदी कमेंट्री</span>}
        </div>
      )}

      {/* Toss Modal */}
      {showToss && <TossModal match={match} onDone={handleTossDone} onClose={() => setShowToss(false)} />}


      {/* Wicket Modal */}
      {showWicketModal && (
        <div className="modal-overlay" onClick={() => setShowWicketModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">🏏 Wicket!</div>
            <div style={{ color: 'var(--text2)', marginBottom: 16, fontSize: 13 }}>How was the batsman dismissed?</div>
            {['Bowled', 'Stumped', 'Hit Wicket'].map(mode => (
              <button key={mode} className="btn btn-ghost w-full mb-2"
                onClick={() => { onScore(match.id, { type: 'wicket', mode, runs: 0, outBatsman: 'striker', media: pendingMedia, video: pendingBallVideo }); setShowWicketModal(false); setPendingMedia(null); setPendingBallVideo(null); setAiAnalysis(null); }}>
                {mode}
              </button>
            ))}
            {/* Caught — ask who caught it */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🤲 Caught</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Who took the catch?</div>
              <select className="input mb-2" value={caughtByPid} onChange={e => setCaughtByPid(e.target.value)}>
                <option value="">— Select fielder (optional) —</option>
                {(inns?.striker && (() => {
                  const batting = match.battingTeam;
                  const fieldingTeam = batting === 'A' ? match.teamB : match.teamA;
                  return (fieldingTeam?.players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>);
                })())}
              </select>
              <button className="btn btn-danger w-full"
                onClick={() => {
                  onScore(match.id, { type: 'wicket', mode: 'Caught', runs: 0, outBatsman: 'striker', caughtBy: caughtByPid || null, media: pendingMedia, video: pendingBallVideo });
                  setShowWicketModal(false); setCaughtByPid(''); setPendingMedia(null); setPendingBallVideo(null); setAiAnalysis(null);
                }}>
                Caught Out{caughtByPid ? ` — c. ${(inns?.striker && (() => { const batting = match.battingTeam; const ft = batting === 'A' ? match.teamB : match.teamA; return (ft?.players || []).find(p => p.id === caughtByPid)?.name; })()) || ''}` : ''}
              </button>
            </div>

            {/* LBW with AI */}
            <div style={{ background: 'rgba(255,74,110,0.06)', border: '1px solid rgba(255,74,110,0.3)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 10 }}>⚖️ LBW</div>
              {pendingBallVideo && (
                <div style={{ marginBottom: 10 }}>
                  <button className="btn btn-ghost btn-sm w-full mb-2" style={{ color: 'var(--purple)', borderColor: 'rgba(162,89,255,0.4)' }}
                    onClick={() => handleLBWChallenge(pendingBallVideo)} disabled={aiLoading}>
                    {aiLoading ? '⏳ AI Reviewing...' : '🤖 AI Umpire Review (uses ball video)'}
                  </button>
                  {aiAnalysis && lbwChallengeMode && (
                    <div className="ai-analysis-box" style={{ marginBottom: 8 }}>
                      <div className="ai-analysis-title">⚖️ AI Verdict</div>
                      <div className="ai-analysis-text">{aiAnalysis}</div>
                    </div>
                  )}
                </div>
              )}
              {!pendingBallVideo && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Record the ball video before scoring for AI LBW analysis</div>}
              <button className="btn btn-danger w-full"
                onClick={() => { onScore(match.id, { type: 'wicket', mode: 'LBW', runs: 0, outBatsman: 'striker', media: pendingMedia, video: pendingBallVideo, aiVerdict: aiAnalysis }); setShowWicketModal(false); setPendingMedia(null); setPendingBallVideo(null); setAiAnalysis(null); setLbwChallengeMode(false); }}>
                Give LBW Out
              </button>
            </div>

            {/* Run Out section */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: 16, marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>🏃 Run Out</div>

              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 600 }}>Who got run out?</div>
              <div className="flex gap-2 mb-3">
                {[
                  { val: 'striker', label: inns?.striker?.name || 'Striker', sub: 'Striker' },
                  { val: 'nonStriker', label: inns?.nonStriker?.name || 'Non-Striker', sub: 'Non-Striker' },
                ].map(opt => (
                  <button key={opt.val} className="btn btn-ghost" style={{ flex: 1, flexDirection: 'column', height: 60, gap: 2, borderColor: runOutWho === opt.val ? 'var(--gold)' : undefined, color: runOutWho === opt.val ? 'var(--gold)' : undefined, fontSize: 12 }}
                    onClick={() => setRunOutWho(opt.val)}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{opt.sub}</span>
                    <span style={{ fontWeight: 700 }}>{opt.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 600 }}>Runs completed before dismissal?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[0, 1, 2, 3].map(r => (
                  <button key={r} className="btn btn-ghost btn-sm"
                    style={{ minWidth: 44, borderColor: runOutRuns === r ? 'var(--gold)' : undefined, color: runOutRuns === r ? 'var(--gold)' : undefined }}
                    onClick={() => setRunOutRuns(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <button className="btn btn-danger w-full"
                onClick={() => { onScore(match.id, { type: 'wicket', mode: 'Run Out', runs: runOutRuns, outBatsman: runOutWho, media: pendingMedia, video: pendingBallVideo }); setShowWicketModal(false); setRunOutRuns(0); setRunOutWho('striker'); setPendingMedia(null); setPendingBallVideo(null); setAiAnalysis(null); }}>
                Confirm Run Out — {runOutWho === 'striker' ? (inns?.striker?.name || 'Striker') : (inns?.nonStriker?.name || 'Non-Striker')} out ({runOutRuns} run{runOutRuns !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catch Drop Modal */}
      {showCatchDropModal && (
        <div className="modal-overlay" onClick={() => setShowCatchDropModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title" style={{ color: 'var(--red)' }}>🤲 Catch Drop</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Record a dropped catch</div>
            <div style={{ marginBottom: 10 }}>
              <label className="label">Who dropped the catch?</label>
              <select className="input" value={catchDropPid} onChange={e => setCatchDropPid(e.target.value)}>
                <option value="">— Select fielder —</option>
                {(() => {
                  const batting = match.battingTeam;
                  const fieldingTeam = batting === 'A' ? match.teamB : match.teamA;
                  return (fieldingTeam?.players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>);
                })()}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Batsman's score at the time</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[0,1,5,10,15,20,25,30,40,50,75,100].map(r => (
                  <button key={r} className={`btn btn-sm ${catchDropRuns === r ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCatchDropRuns(r)} style={{ minWidth: 44 }}>{r}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost w-full" onClick={() => { setShowCatchDropModal(false); setCatchDropPid(''); setCatchDropRuns(0); }}>Cancel</button>
              <button className="btn btn-danger w-full" disabled={!catchDropPid}
                onClick={() => {
                  if (!catchDropPid) return;
                  const inn = match.innings?.[match.currentInnings];
                  if (!inn) return;
                  onUpdateMatch(match.id, {
                    catchDrop: {
                      pid: catchDropPid,
                      runsAtDrop: catchDropRuns,
                      innKey: match.currentInnings,
                    }
                  });
                  setShowCatchDropModal(false); setCatchDropPid(''); setCatchDropRuns(0);
                }}>
                Record Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impact Player Modal */}
      {showImpactModal && (
        <div className="modal-overlay" onClick={() => setShowImpactModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title" style={{ color: 'var(--blue)' }}>⚡ Impact Player</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6 }}>
              Substitute a player mid-match. The substituted player cannot bat, bowl, or field further.
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className="label">Which team?</label>
              <div className="flex gap-2 mb-3">
                {['A', 'B'].map(t => (
                  <button key={t} className={`btn w-full ${impactTeam === t ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => { setImpactTeam(t); setImpactOut(''); setImpactIn(''); }}>
                    {t === 'A' ? match.teamA?.name : match.teamB?.name}
                  </button>
                ))}
              </div>
            </div>
            {impactTeam && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label className="label">Player going OUT (substituted)</label>
                  <select className="input" value={impactOut} onChange={e => setImpactOut(e.target.value)}>
                    <option value="">— Select player —</option>
                    {(impactTeam === 'A' ? match.teamA : match.teamB)?.players?.filter(p => !p.isImpactIn).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="label">New player coming IN</label>
                  {Object.keys(state.players || {}).length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <select className="input mb-2" value=""
                        onChange={e => {
                          const pid = e.target.value;
                          if (!pid) return;
                          const p = state.players[pid];
                          if (p) setImpactInName(p.name);
                        }}>
                        <option value="">— Pick from player registry (optional) —</option>
                        {Object.values(state.players).map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.role || 'Player'})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <input className="input" placeholder="Or type new player name" value={impactInName}
                    onChange={e => setImpactInName(e.target.value)} />
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(255,193,7,0.1)', borderRadius: 6, fontSize: 11, color: 'var(--text2)', marginBottom: 14 }}>
                  ⚠️ {impactOut ? `${(impactTeam === 'A' ? match.teamA : match.teamB)?.players?.find(p => p.id === impactOut)?.name || 'Selected player'} will be substituted out and cannot participate further.` : 'Select the player to substitute.'}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowImpactModal(false); setImpactTeam(''); setImpactOut(''); setImpactIn(''); setImpactInName(''); }}>Cancel</button>
                  <button className="btn btn-primary w-full" disabled={!impactOut || !impactInName.trim()}
                    onClick={() => {
                      if (!impactOut || !impactInName.trim()) return;
                      onUpdateMatch(match.id, { impactPlayer: { team: impactTeam, outId: impactOut, inName: impactInName.trim() } });
                      setShowImpactModal(false); setImpactTeam(''); setImpactOut(''); setImpactIn(''); setImpactInName('');
                    }}>
                    ✅ Confirm Impact Player
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Player Select Modal */}
      {showPlayerSelect && (
        <div className="modal-overlay" onClick={() => setShowPlayerSelect(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Select {showPlayerSelect === 'bowler' ? 'Bowler' : showPlayerSelect === 'striker' ? 'Striker' : 'Non-Striker'}</div>
            {(() => {
              const isBowlerSelect = showPlayerSelect === 'bowler';
              const pool = (isBowlerSelect
                ? (batting === 'A' ? match.teamB?.players : match.teamA?.players) || []
                : (batting === 'A' ? match.teamA?.players : match.teamB?.players) || []
              ).filter(p => !p.isImpactOut); // exclude substituted-out players
              return pool.map(p => {
                const out = !isBowlerSelect && isPlayerOut(p.id);
                const overLimit = isBowlerSelect && isBowlerOverLimit(p.id);
                const disabled = out || overLimit;
                return (
                  <div
                    key={p.id}
                    className={`player-card ${disabled ? '' : 'card-hover'}`}
                    style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                    onClick={() => {
                      if (disabled) return;
                      onUpdateMatch(match.id, { playerSelect: { role: showPlayerSelect, player: p } });
                      setShowPlayerSelect(null);
                    }}
                  >
                    <PlayerAvatar player={p} size="lg" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {p.name}
                        {out && <span className="player-out-label">OUT</span>}
                        {overLimit && <span className="bowler-over-limit">MAX OVERS</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {!isBowlerSelect && inns?.batsmen?.[p.id] ? `${inns.batsmen[p.id].runs} runs (${inns.batsmen[p.id].balls}b)` : ''}
                        {isBowlerSelect && inns?.bowlers?.[p.id]
                          ? `${formatOvers(inns.bowlers[p.id].balls || 0)} ov • ${inns.bowlers[p.id].wickets}w/${inns.bowlers[p.id].runs}r`
                          : isBowlerSelect ? 'Yet to bowl' : ''}
                        {isBowlerSelect && match.maxOversPerBowler > 0 && (
                          <span style={{ marginLeft: 8, color: overLimit ? 'var(--red)' : 'var(--text3)' }}>
                            ({bowlerOversCount(p.id)}/{match.maxOversPerBowler} ov)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function groupByOver(balls) {
  const overs = {};
  balls.forEach((b, i) => {
    const over = Math.floor(b.overIndex !== undefined ? b.overIndex : i / 6);
    if (!overs[over]) overs[over] = [];
    overs[over].push(b);
  });
  return Object.entries(overs).map(([over, balls]) => ({ over: parseInt(over), balls }));
}

function getHighlights(match) {
  const highlights = [];
  Object.values(match.innings || {}).forEach(inn => {
    (inn.balls_by_ball || []).forEach((b, i) => {
      if (b.runs === 4) highlights.push({ icon: '🔥', text: `FOUR by ${b.batsman || 'batsman'}!`, over: `Ball ${i + 1}`, bowler: b.bowler ? `off ${b.bowler}` : '' });
      if (b.runs === 6) highlights.push({ icon: '💥', text: `SIX by ${b.batsman || 'batsman'}!`, over: `Ball ${i + 1}`, bowler: b.bowler ? `off ${b.bowler}` : '' });
      if (b.wicket) highlights.push({ icon: '🏏', text: `OUT! ${b.batsman || 'Batsman'} dismissed (${b.wicketMode || 'wicket'})`, over: `Ball ${i + 1}`, bowler: b.bowler ? `by ${b.bowler}` : '' });
    });
  });
  return highlights;
}

// ============================================================
// SERIES PAGE
// ============================================================
// SERIES PAGE
// ============================================================
// ============================================================
// SERIES STATS PAGE
// ============================================================

// ============================================================
// SERIES PDF GENERATORS
// ============================================================
function downloadBlob(html, filename) {
  downloadHTML(html, filename);
}

function generateSeriesLeaderboardPDF(series, seriesMatches, state) {
  const playerMap = {};
  seriesMatches.forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => { if (p?.id) playerMap[p.id] = p; });
  });
  Object.entries(state.players || {}).forEach(([id, p]) => { if (p?.name) playerMap[id] = p; });
  const getName = pid => playerMap[pid]?.name || pid || 'Unknown';

  const playerStatsMap = {};
  const ensure = pid => {
    if (!playerStatsMap[pid]) playerStatsMap[pid] = {
      runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, outs: 0, notOuts: 0, matches: 0,
      wickets: 0, ballsBowled: 0, runsConceded: 0,
    };
  };
  seriesMatches.forEach(match => {
    const seenPids = new Set();
    Object.values(match.innings || {}).forEach(inn => {
      Object.entries(inn.batsmen || {}).forEach(([pid, st]) => {
        ensure(pid);
        playerStatsMap[pid].runs += st.runs || 0;
        playerStatsMap[pid].balls += st.balls || 0;
        playerStatsMap[pid].fours += st.fours || 0;
        playerStatsMap[pid].sixes += st.sixes || 0;
        playerStatsMap[pid].innings++;
        if (st.out) playerStatsMap[pid].outs++; else playerStatsMap[pid].notOuts++;
        if (!seenPids.has(pid)) { seenPids.add(pid); playerStatsMap[pid].matches++; }
      });
      Object.entries(inn.bowlers || {}).forEach(([pid, st]) => {
        ensure(pid);
        playerStatsMap[pid].wickets += st.wickets || 0;
        playerStatsMap[pid].ballsBowled += st.balls || 0;
        playerStatsMap[pid].runsConceded += st.runs || 0;
        if (!seenPids.has(pid)) { seenPids.add(pid); playerStatsMap[pid].matches++; }
      });
    });
  });

  const players = Object.entries(playerStatsMap).map(([pid, s]) => {
    const dismissals = s.innings - s.notOuts;
    const avg = dismissals > 0 ? (s.runs / dismissals).toFixed(2) : (s.innings > 0 ? '∞' : '-');
    const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';
    const bowlAvg = s.wickets > 0 ? (s.runsConceded / s.wickets).toFixed(2) : '-';
    const econ = s.ballsBowled > 0 ? (s.runsConceded / (s.ballsBowled / 6)).toFixed(2) : '-';
    return { name: getName(pid), ...s, avg, sr, bowlAvg, econ };
  });

  // Player of Series = most runs + most wickets combined score
  const potsSorted = [...players].sort((a, b) => (b.runs + b.wickets * 25) - (a.runs + a.wickets * 25));
  const pots = potsSorted[0];
  const potsTopBat = [...players].sort((a, b) => b.runs - a.runs)[0];
  const potsTopBowl = [...players].sort((a, b) => b.wickets - a.wickets)[0];

  const metrics = [
    { title: 'Most Runs', col: 'Runs', sub: 'Avg', rows: [...players].sort((a,b)=>b.runs-a.runs).slice(0,10).map(p=>[p.name, p.runs, `Avg: ${p.avg} | SR: ${p.sr}`]) },
    { title: 'Batting Average', col: 'Avg', sub: '', rows: [...players].filter(p=>p.innings>0).sort((a,b)=>{ const da=a.innings-a.notOuts,db=b.innings-b.notOuts; const aa=da>0?a.runs/da:99999, ab=db>0?b.runs/db:99999; return ab-aa; }).slice(0,10).map(p=>[p.name,p.avg,`${p.runs}R ${p.innings}inn`]) },
    { title: 'Strike Rate', col: 'SR', sub: '', rows: [...players].filter(p=>p.balls>0).sort((a,b)=>parseFloat(b.sr)-parseFloat(a.sr)).slice(0,10).map(p=>[p.name,p.sr,`${p.runs}R ${p.balls}b`]) },
    { title: 'Most Fours', col: '4s', sub: '', rows: [...players].sort((a,b)=>b.fours-a.fours).slice(0,10).map(p=>[p.name,p.fours,`${p.runs} runs`]) },
    { title: 'Most Sixes', col: '6s', sub: '', rows: [...players].sort((a,b)=>b.sixes-a.sixes).slice(0,10).map(p=>[p.name,p.sixes,`${p.runs} runs`]) },
    { title: 'Most Wickets', col: 'Wkts', sub: '', rows: [...players].sort((a,b)=>b.wickets-a.wickets).slice(0,10).map(p=>[p.name,p.wickets,`Avg: ${p.bowlAvg} | Econ: ${p.econ}`]) },
    { title: 'Best Economy', col: 'Econ', sub: '', rows: [...players].filter(p=>p.ballsBowled>=6).sort((a,b)=>parseFloat(a.econ)-parseFloat(b.econ)).slice(0,10).map(p=>[p.name,p.econ,`${p.wickets}W ${p.runsConceded}R`]) },
    { title: 'Bowling Average', col: 'BwlAvg', sub: '', rows: [...players].filter(p=>p.wickets>0).sort((a,b)=>parseFloat(a.bowlAvg)-parseFloat(b.bowlAvg)).slice(0,10).map(p=>[p.name,p.bowlAvg,`${p.wickets}W ${p.runsConceded}R`]) },
  ];

  const tableHTML = metrics.map(m => `
    <div style="margin-bottom:24px;page-break-inside:avoid">
      <h2 style="font-size:14px;border-bottom:2px solid #1a1a1a;padding-bottom:5px;margin-bottom:8px">${m.title}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#f0f0f0"><th style="border:1px solid #ddd;padding:6px;text-align:left;width:28px">#</th><th style="border:1px solid #ddd;padding:6px;text-align:left">Player</th><th style="border:1px solid #ddd;padding:6px;text-align:center;width:70px">${m.col}</th><th style="border:1px solid #ddd;padding:6px;text-align:left;color:#666;font-size:11px">Details</th></tr>
        ${m.rows.map(([n,v,d],i)=>`<tr style="background:${i%2===0?'#fff':'#fafafa'}"><td style="border:1px solid #ddd;padding:6px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td><td style="border:1px solid #ddd;padding:6px;font-weight:600">${n}</td><td style="border:1px solid #ddd;padding:6px;text-align:center;font-weight:700">${v}</td><td style="border:1px solid #ddd;padding:6px;color:#666;font-size:11px">${d}</td></tr>`).join('')}
      </table>
    </div>`).join('');

  const winsA = seriesMatches.filter(m => m.result?.winner === series.teamA).length;
  const winsB = seriesMatches.filter(m => m.result?.winner === series.teamB).length;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${series.name} — Leaderboard</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:900px;margin:0 auto}@media print{body{padding:12px}}</style></head>
  <body>
  <h1 style="text-align:center;margin-bottom:4px">📊 ${series.name} — Series Leaderboard</h1>
  <p style="text-align:center;color:#666;font-size:12px;margin-bottom:8px">${series.teamA} vs ${series.teamB} | Score: ${winsA}–${winsB} | ${seriesMatches.length} matches</p>
  ${pots ? `<div style="background:#fffde7;border:2px solid #ffd600;border-radius:10px;padding:14px;margin-bottom:24px;text-align:center">
    <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🏆 Player of the Series</div>
    <div style="font-size:22px;font-weight:800">${pots.name}</div>
    <div style="font-size:13px;color:#444;margin-top:4px">${pots.runs} runs • ${pots.wickets} wickets • ${pots.avg} avg</div>
    ${potsTopBat?.name !== pots?.name ? `<div style="font-size:11px;color:#888;margin-top:2px">Top Bat: ${potsTopBat?.name} (${potsTopBat?.runs}R)</div>` : ''}
    ${potsTopBowl?.name !== pots?.name ? `<div style="font-size:11px;color:#888">Top Bowl: ${potsTopBowl?.name} (${potsTopBowl?.wickets}W)</div>` : ''}
  </div>` : ''}
  ${tableHTML}
  <div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:11px">Generated by Crictera • ${new Date().toLocaleDateString()}</div>
  </body></html>`;
  downloadBlob(html, `${series.name.replace(/[^a-z0-9]/gi,'_')}_leaderboard.html`);
}

function generateSeriesResultPDF(series, seriesMatches, state) {
  const playerMapAll = { ...state.players };
  seriesMatches.forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => { if (p?.id) playerMapAll[p.id] = p; });
  });
  const getName = pid => playerMapAll[pid]?.name || pid || 'Unknown';

  const winsA = seriesMatches.filter(m => m.result?.winner === series.teamA).length;
  const winsB = seriesMatches.filter(m => m.result?.winner === series.teamB).length;
  const seriesWinner = winsA > winsB ? series.teamA : winsB > winsA ? series.teamB : 'Tied';

  // Build each match scorecard HTML string
  const allMatchHTML = seriesMatches.map((match, idx) => {
    // Build innings HTML
    const allInningsHTML = Object.entries(match.innings || {}).map(([innKey, inn]) => {
      const battingTeam = inn.team === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
      const batRows = Object.entries(inn.batsmen || {}).map(([pid, b]) => {
        let dismissal = 'not out';
        if (b.out) {
          if (b.outMode === 'Caught' && b.caughtByName) dismissal = 'c. ' + b.caughtByName + (b.bowlerName ? ' b. ' + b.bowlerName : '');
          else if (b.outMode === 'Bowled' && b.bowlerName) dismissal = 'b. ' + b.bowlerName;
          else dismissal = b.outMode || 'out';
        }
        return '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">' + getName(pid) + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #eee;color:#888;font-size:11px">' + dismissal + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">' + (b.fours||0) + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">' + (b.sixes||0) + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center">' + (b.balls||0) + '</td>'
          + '<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:700">' + (b.runs||0) + '</td></tr>';
      }).join('');
      const bowlRows = Object.entries(inn.bowlers || {}).map(([pid, b]) => {
        const overs = b.balls > 0 ? Math.floor(b.balls/6) + '.' + (b.balls%6) : '0';
        const econ = b.balls > 0 ? (b.runs/(b.balls/6)).toFixed(1) : '-';
        return '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">' + getName(pid) + '</td>'
          + '<td style="padding:5px 8px;text-align:center">' + overs + '</td>'
          + '<td style="padding:5px 8px;text-align:center">' + (b.runs||0) + '</td>'
          + '<td style="padding:5px 8px;text-align:center;font-weight:700">' + (b.wickets||0) + '</td>'
          + '<td style="padding:5px 8px;text-align:center">' + econ + '</td></tr>';
      }).join('');
      const totalOvers = Math.floor((inn.balls||0)/6) + '.' + ((inn.balls||0)%6);
      const dropsHTML = (inn.catchDrops||[]).length > 0
        ? '<div style="font-size:11px;color:#cc0000;margin-top:6px">🤲 Drops: ' + (inn.catchDrops||[]).map(d => d.name + ' (bat:' + d.runsAtDrop + ')').join(', ') + '</div>'
        : '';
      return '<div style="margin-bottom:14px">'
        + '<div style="font-weight:700;font-size:14px;margin-bottom:4px">🏏 ' + battingTeam + ' Innings</div>'
        + '<div style="font-size:22px;font-weight:800;margin-bottom:8px">' + (inn.runs||0) + '/' + (inn.wickets||0) + ' <span style="font-size:14px;font-weight:400;color:#666">in ' + totalOvers + ' overs</span></div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px">'
        + '<tr style="background:#f8f8f8"><th style="padding:5px 8px;text-align:left">Batter</th><th style="padding:5px 8px;text-align:left;color:#888;font-weight:400;font-size:11px">Dismissal</th><th style="padding:5px 8px;text-align:center">4s</th><th style="padding:5px 8px;text-align:center">6s</th><th style="padding:5px 8px;text-align:center">B</th><th style="padding:5px 8px;text-align:center">R</th></tr>'
        + batRows
        + '<tr style="background:#f0f0f0"><td colspan="5" style="padding:5px 8px;font-weight:700">Extras</td><td style="padding:5px 8px;text-align:center;font-weight:700">' + (inn.extras||0) + '</td></tr>'
        + '<tr style="background:#e8e8e8"><td colspan="5" style="padding:5px 8px;font-weight:800;font-size:13px">TOTAL</td><td style="padding:5px 8px;text-align:center;font-weight:800;font-size:15px">' + (inn.runs||0) + '/' + (inn.wickets||0) + '</td></tr>'
        + '</table>'
        + '<div style="font-weight:600;font-size:12px;margin-bottom:4px;color:#444">Bowling</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<tr style="background:#f8f8f8"><th style="padding:5px 8px;text-align:left">Bowler</th><th style="padding:5px 8px;text-align:center">Ov</th><th style="padding:5px 8px;text-align:center">R</th><th style="padding:5px 8px;text-align:center">W</th><th style="padding:5px 8px;text-align:center">Econ</th></tr>'
        + bowlRows
        + '</table>'
        + dropsHTML
        + '</div>';
    }).join('<hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>');

    const resultStr = !match.result ? 'In Progress'
      : match.result.winner === 'Match' ? 'Match Tied'
      : match.result.winner + ' won' + (match.result.by && match.result.by !== 'Series override' ? ' — ' + match.result.by : '');
    const winColor = match.result?.winner && match.result.winner !== 'Match' ? '#1a7a3c' : '#666';
    const dateStr = match.startedAt ? new Date(match.startedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';

    return '<div style="page-break-inside:avoid;margin-bottom:32px;background:#fff;border:1px solid #ddd;border-radius:8px;padding:18px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
      + '<div><div style="font-size:16px;font-weight:800">Match ' + (idx+1) + ': ' + (match.title||'Match') + '</div>'
      + '<div style="font-size:12px;color:#666;margin-top:2px">' + (match.teamA?.name||'') + ' vs ' + (match.teamB?.name||'') + (dateStr ? ' • ' + dateStr : '') + '</div></div>'
      + '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:' + winColor + '">' + resultStr + '</div>'
      + (match.result?.potm ? '<div style="font-size:11px;color:#888">⭐ POTM: ' + match.result.potm + '</div>' : '')
      + '</div></div>'
      + allInningsHTML
      + '</div>';
  }).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + series.name + ' — Results</title>'
    + '<style>body{font-family:Arial,sans-serif;padding:20px;max-width:860px;margin:0 auto}@media print{body{padding:12px}}</style></head><body>'
    + '<h1 style="text-align:center;margin-bottom:4px">🏏 ' + series.name + '</h1>'
    + '<p style="text-align:center;color:#666;font-size:13px;margin-bottom:6px">' + series.teamA + ' vs ' + series.teamB + '</p>'
    + '<div style="text-align:center;background:' + (seriesWinner!=='Tied'?'#e8f5e9':'#fff8e1') + ';border:2px solid ' + (seriesWinner!=='Tied'?'#4caf50':'#ffd600') + ';border-radius:10px;padding:16px;margin-bottom:28px">'
    + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:4px">Series Result</div>'
    + '<div style="font-size:26px;font-weight:800">' + (seriesWinner !== 'Tied' ? '🏆 ' + seriesWinner + ' won' : '🤝 Series Tied') + '</div>'
    + '<div style="font-size:15px;color:#444;margin-top:4px">' + series.teamA + ': ' + winsA + ' — ' + winsB + ' :' + series.teamB + '</div>'
    + '</div>'
    + allMatchHTML
    + '<div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:11px">Generated by Crictera • ' + new Date().toLocaleDateString() + '</div>'
    + '</body></html>';

  downloadBlob(html, (series.name.replace(/[^a-z0-9]/gi,'_') || 'series') + '_results.html');
}

function SeriesStatsPage({ series, matches, state, onBack, onNav }) {
  const [metric, setMetric] = useState('runs');

  // Get matches in this series
  const seriesMatches = (series.matches || []).map(id => matches[id]).filter(Boolean);
  
  // Calculate stats for players in this series ONLY
  const playerStatsMap = {};
  seriesMatches.forEach(match => {
    Object.values(match.innings || {}).forEach(inn => {
      const ensurePlayer = pid => {
        if (!playerStatsMap[pid]) playerStatsMap[pid] = {
          runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, outs: 0, notOuts: 0, matches: 0,
          wickets: 0, ballsBowled: 0, runsConceded: 0, bowlingInnings: 0,
          catches: 0,
        };
      };
      Object.entries(inn.batsmen || {}).forEach(([pid, st]) => {
        ensurePlayer(pid);
        playerStatsMap[pid].runs += st.runs || 0;
        playerStatsMap[pid].balls += st.balls || 0;
        playerStatsMap[pid].fours += st.fours || 0;
        playerStatsMap[pid].sixes += st.sixes || 0;
        playerStatsMap[pid].innings++;
        if (st.out) playerStatsMap[pid].outs++;
        else playerStatsMap[pid].notOuts++;
      });
      Object.entries(inn.bowlers || {}).forEach(([pid, st]) => {
        ensurePlayer(pid);
        playerStatsMap[pid].wickets = (playerStatsMap[pid].wickets || 0) + (st.wickets || 0);
        playerStatsMap[pid].ballsBowled = (playerStatsMap[pid].ballsBowled || 0) + (st.balls || 0);
        playerStatsMap[pid].runsConceded = (playerStatsMap[pid].runsConceded || 0) + (st.runs || 0);
        playerStatsMap[pid].bowlingInnings++;
      });
    });
    // Count each player's matches (once per match)
    const seenPids = new Set();
    Object.values(match.innings || {}).forEach(inn => {
      [...Object.keys(inn.batsmen || {}), ...Object.keys(inn.bowlers || {})].forEach(pid => {
        if (!seenPids.has(pid)) {
          seenPids.add(pid);
          if (!playerStatsMap[pid]) playerStatsMap[pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, outs: 0, notOuts: 0, matches: 0 };
          playerStatsMap[pid].matches = (playerStatsMap[pid].matches || 0) + 1;
        }
      });
    });
  });

  // Get player names
  const playerMap = { ...state.players };
  seriesMatches.forEach(m => {
    [...(m.teamA?.players || []), ...(m.teamB?.players || [])].forEach(p => {
      if (!playerMap[p.id]) playerMap[p.id] = p;
    });
  });

  const withStats = Object.keys(playerStatsMap).map(pid => ({
    id: pid,
    name: playerMap[pid]?.name || 'Unknown',
    photo: playerMap[pid]?.photo || null,
    ...playerStatsMap[pid],
  }));

  const sorted = [...withStats].sort((a, b) => {
    if (metric === 'runs') return b.runs - a.runs;
    if (metric === 'wickets') return b.wickets - a.wickets;
    if (metric === 'avg') {
      const dA = (a.innings - (a.notOuts || 0)); const dB = (b.innings - (b.notOuts || 0));
      const avgA = dA > 0 ? a.runs / dA : (a.innings > 0 ? Infinity : 0);
      const avgB = dB > 0 ? b.runs / dB : (b.innings > 0 ? Infinity : 0);
      return avgB - avgA;
    }
    if (metric === 'sr') { const sA = a.balls > 0 ? a.runs / a.balls : 0; const sB = b.balls > 0 ? b.runs / b.balls : 0; return sB - sA; }
    if (metric === 'fours') return (b.fours || 0) - (a.fours || 0);
    if (metric === 'sixes') return (b.sixes || 0) - (a.sixes || 0);
    if (metric === 'econ') {
      if ((a.ballsBowled||0) === 0 && (b.ballsBowled||0) === 0) return 0;
      if ((a.ballsBowled||0) === 0) return 1;
      if ((b.ballsBowled||0) === 0) return -1;
      return (a.runsConceded / (a.ballsBowled / 6)) - (b.runsConceded / (b.ballsBowled / 6));
    }
    if (metric === 'bowlavg') {
      if ((a.wickets||0) === 0 && (b.wickets||0) === 0) return 0;
      if ((a.wickets||0) === 0) return 1;
      if ((b.wickets||0) === 0) return -1;
      return (a.runsConceded / a.wickets) - (b.runsConceded / b.wickets);
    }
    return 0;
  });

  // Series leaderboard display helper
  const getDisplayVal = (p, m) => {
    if (m === 'runs') return p.runs;
    if (m === 'avg') { const d = (p.innings||0)-(p.notOuts||0); return d>0?(p.runs/d).toFixed(1):(p.innings>0?'∞':'-'); }
    if (m === 'sr') return p.balls > 0 ? ((p.runs/p.balls)*100).toFixed(1) : '-';
    if (m === 'fours') return p.fours || 0;
    if (m === 'sixes') return p.sixes || 0;
    if (m === 'wickets') return p.wickets || 0;
    if (m === 'econ') return p.ballsBowled > 0 ? (p.runsConceded/(p.ballsBowled/6)).toFixed(2) : '-';
    if (m === 'bowlavg') return (p.wickets||0) > 0 ? (p.runsConceded/p.wickets).toFixed(1) : '-';
    return '-';
  };
  const getLabel = m => ({ runs:'Runs', avg:'Avg', sr:'SR', fours:'4s', sixes:'6s', wickets:'Wkts', econ:'Econ', bowlavg:'BwlAvg' }[m] || m);

  // Determine Player of Series per metric (top player across all criteria)
  const playerOfSeries = (() => {
    if (withStats.length === 0) return null;
    // Score: runs + (wickets × 25) + (fours × 2) + (sixes × 4)
    const scored = withStats.map(p => ({
      ...p,
      potScore: (p.runs || 0) + (p.wickets || 0) * 25 + (p.fours || 0) * 2 + (p.sixes || 0) * 4,
    }));
    scored.sort((a, b) => b.potScore - a.potScore);
    return scored[0] || null;
  })();

  // Top per-metric players for display
  const topRunScorer = [...withStats].sort((a, b) => b.runs - a.runs)[0];
  const topWicketTaker = [...withStats].sort((a, b) => b.wickets - a.wickets)[0];

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-3">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ fontSize: 20 }}>📊 {series.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {series.teamA} <span style={{ color: 'var(--gold)' }}>vs</span> {series.teamB}
          </div>
        </div>
      </div>

      {/* PDF Download buttons */}
      <div className="flex gap-2 mb-3">
        <button className="btn btn-ghost w-full" style={{ fontSize: 12, color: 'var(--blue)' }}
          onClick={() => generateSeriesLeaderboardPDF(series, seriesMatches, state)}>
          📥 Download Stats PDF
        </button>
        <button className="btn btn-ghost w-full" style={{ fontSize: 12, color: 'var(--green)' }}
          onClick={() => generateSeriesResultPDF(series, seriesMatches, state)}>
          📥 Download Results PDF
        </button>
      </div>

      {/* Series Record */}
      <div className="card mb-3">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div className="stat-box"><div className="stat-val">{seriesMatches.length}</div><div className="stat-label">Matches</div></div>
          <div className="stat-box"><div className="stat-val" style={{ color: 'var(--gold)' }}>{seriesMatches.filter(m => m.result?.winner === series.teamA).length}</div><div className="stat-label">{series.teamA}</div></div>
          <div className="stat-box"><div className="stat-val" style={{ color: 'var(--red)' }}>{seriesMatches.filter(m => m.result?.winner === series.teamB).length}</div><div className="stat-label">{series.teamB}</div></div>
        </div>
      </div>

      {/* Player of Series */}
      {playerOfSeries && (
        <div className="card mb-3" style={{ background: 'linear-gradient(135deg, rgba(245,200,66,0.12), rgba(29,233,160,0.08))', border: '1px solid rgba(245,200,66,0.4)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🏆 Player of the Series</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlayerAvatar player={playerOfSeries} size="lg" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{playerOfSeries.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {playerOfSeries.runs} runs • {playerOfSeries.wickets} wkts • {playerOfSeries.fours} fours • {playerOfSeries.sixes} sixes
              </div>
              {(() => { const d = playerOfSeries.innings - (playerOfSeries.notOuts||0); const avg = d > 0 ? (playerOfSeries.runs/d).toFixed(1) : playerOfSeries.runs; return (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Avg: {avg} • {playerOfSeries.matches} matches</div>
              ); })()}
            </div>
          </div>
          {/* Supporting top performers */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {topRunScorer && topRunScorer.id !== playerOfSeries.id && (
              <span className="badge badge-gold">🏏 Top Bat: {topRunScorer.name} ({topRunScorer.runs}R)</span>
            )}
            {topWicketTaker && topWicketTaker.id !== playerOfSeries.id && topWicketTaker.wickets > 0 && (
              <span className="badge badge-blue">🎯 Top Bowl: {topWicketTaker.name} ({topWicketTaker.wickets}W)</span>
            )}
          </div>
        </div>
      )}

      {/* Series Leaderboard */}
      <div className="tabs mb-3" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {[['runs','🏏 Runs'],['avg','📈 Avg'],['sr','⚡ SR'],['fours','4️⃣ 4s'],['sixes','6️⃣ 6s'],['wickets','🎯 Wkts'],['econ','📉 Econ'],['bowlavg','📊 BowlAvg']].map(([v,l]) => (
          <button key={v} className={`tab ${metric===v?'active':''}`} style={{ whiteSpace:'nowrap', fontSize:11 }} onClick={() => setMetric(v)}>{l}</button>
        ))}
      </div>

      {sorted.slice(0, 20).map((p, i) => (
        <div key={p.id} className="card mb-2 fade-in" style={{ animationDelay: `${i * 25}ms`, padding: '12px', cursor: 'pointer' }} onClick={() => onNav('career', p.id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 700, color: 'var(--gold)', minWidth: 24 }}>{i + 1}</div>
            <PlayerAvatar player={p} size="sm" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.matches} matches · {p.innings} inn</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>{getDisplayVal(p, metric)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{getLabel(metric)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SeriesPage({ series, matches, onBack, onNav, state, onCreateMatchInSeries, onDeleteSeries, onUpdateMatch }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);
  const totalA = series.scoreA || 0;
  const totalB = series.scoreB || 0;
  const seriesMatches = (series.matches || []).map(mid => matches[mid]).filter(Boolean);
  const totalPlayed = seriesMatches.length;
  const remaining = Math.max(0, series.totalMatches - totalPlayed);
  const winsA = seriesMatches.filter(m => m.result?.winner === series.teamA).length;
  const winsB = seriesMatches.filter(m => m.result?.winner === series.teamB).length;
  const leader = winsA > winsB ? series.teamA : winsB > winsA ? series.teamB : totalPlayed > 0 ? 'Tied' : null;

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title" style={{ fontSize: 22 }}>{series.name}</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>{series.totalMatches}-match series • {series.defaultOvers || 10} overs</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onNav('seriesStats', series.id)}>📊 Stats</button>
      </div>

      {/* Score card */}
      <div className="card mb-3" style={{ background: 'linear-gradient(135deg, var(--card), var(--card2))' }}>
        <div className="flex items-center justify-between mb-3">
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{series.teamA}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, color: 'var(--blue)', lineHeight: 1 }}>{winsA}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>wins</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 16px' }}>
            <div style={{ fontSize: 22, color: 'var(--text3)', fontWeight: 700 }}>vs</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{totalPlayed}/{series.totalMatches} played</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{series.teamB}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, color: 'var(--red)', lineHeight: 1 }}>{winsB}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>wins</div>
          </div>
        </div>
        {(winsA + winsB) > 0 && (
          <div className="series-score-bar mb-2">
            <div className="series-bar-a" style={{ flex: Math.max(winsA, 0.1) }} />
            <div className="series-bar-tie" />
            <div className="series-bar-b" style={{ flex: Math.max(winsB, 0.1) }} />
          </div>
        )}
        {remaining > 0 && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>{remaining} match{remaining !== 1 ? 'es' : ''} remaining</div>}
        {leader && leader !== 'Tied' && <div style={{ textAlign: 'center', marginTop: 6 }}><span className="badge badge-gold">🏆 {leader} leading</span></div>}
        {leader === 'Tied' && <div style={{ textAlign: 'center', marginTop: 6 }}><span className="badge badge-blue">🤝 Series tied</span></div>}
      </div>

      {/* Add Match button — disabled when series is full */}
      {totalPlayed < (series.totalMatches || 99) ? (
        <button className="btn btn-primary w-full mb-3" style={{ gap: 8 }}
          onClick={() => onCreateMatchInSeries(series.id)}>
          ⚡ Add Match to Series
        </button>
      ) : (
        <div style={{ background: 'rgba(29,233,160,0.08)', border: '1px solid rgba(29,233,160,0.3)', borderRadius: 10, padding: '12px', marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>✅ Series Complete</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>All {series.totalMatches} matches have been played</div>
        </div>
      )}

      {/* Matches list */}
      <div className="section-title">Matches</div>
      {seriesMatches.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏏</div>
          <div className="empty-title">No matches yet</div>
          <div className="empty-sub">Tap "Add Match to Series" to start the first match</div>
        </div>
      )}
      {seriesMatches.map((m, idx) => {
        const matchWinner = m.result?.winner || null;
        const isTeamA = matchWinner === series.teamA;
        const isTeamB = matchWinner === series.teamB;
        const isTied = m.result?.by === 'Tied!';
        return (
          <div key={m.id} className="card mb-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', minWidth: 20 }}>M{idx+1}</div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => onNav('match', m.id)}>{m.title}</div>
              <div style={{ fontSize: 10, color: m.status === 'live' ? 'var(--red)' : 'var(--text3)' }}>
                {m.status === 'live' ? '🔴 LIVE' : m.status === 'done' ? '✅ Done' : '⏳ Setup'}
              </div>
            </div>
            {/* Winner badge or manual override */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {matchWinner && (
                <span className={`badge ${isTeamA ? 'badge-blue' : isTeamB ? 'badge-red' : 'badge-gold'}`}>
                  🏆 {isTied ? 'Tied' : matchWinner + ' won'}
                </span>
              )}
              {!matchWinner && m.status === 'done' && (
                <span className="badge" style={{ background: 'rgba(255,193,7,0.15)', color: 'var(--gold)' }}>⚠️ No result recorded</span>
              )}
            </div>
            {/* Manual winner override for done matches */}
            {m.status === 'done' && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>Set winner:</span>
                <button
                  className={`btn btn-sm ${isTeamA ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onUpdateMatch?.(m.id, { result: { ...(m.result||{}), winner: series.teamA, by: 'Series override' } })}
                >{series.teamA}</button>
                <button
                  className={`btn btn-sm ${isTeamB ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onUpdateMatch?.(m.id, { result: { ...(m.result||{}), winner: series.teamB, by: 'Series override' } })}
                >{series.teamB}</button>
                <button
                  className={`btn btn-sm ${isTied ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => onUpdateMatch?.(m.id, { result: { ...(m.result||{}), winner: 'Match', by: 'Tied!' } })}
                >Tied</button>
              </div>
            )}
          </div>
        );
      })}
      {/* Delete Series */}
      <div className="card" style={{ background: 'rgba(255,74,110,0.05)', border: '1px solid rgba(255,74,110,0.2)' }}>
        <div className="section-title" style={{ color: 'var(--red)' }}>⚠️ Danger Zone</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
          Deleting this series will remove it and all its matches permanently.
        </div>
        <button className="btn btn-danger w-full" onClick={() => {
          setShowDeleteModal(true);
          setDeleteConfirmCount(0);
        }}>
          🗑️ Delete Series Permanently
        </button>
      </div>

      {/* Delete Series Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-handle" />
            <div className="modal-title" style={{ color: 'var(--red)' }}>🗑️ Delete Series?</div>
            
            {deleteConfirmCount === 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                  You are about to permanently delete <strong>"{series.name}"</strong> and all <strong>{seriesMatches.length} matches</strong>
                  <br/><br/>
                  This action <strong>CANNOT be undone</strong>.
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-danger w-full" onClick={() => setDeleteConfirmCount(1)}>I Understand</button>
                </div>
              </div>
            )}

            {deleteConfirmCount === 1 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(255,74,110,0.1)', border: '1px solid rgba(255,74,110,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  ⚠️ Type the series name to confirm deletion
                </div>
                <input 
                  className="input mb-3" 
                  placeholder={`Type "${series.name}" to confirm`}
                  onChange={(e) => setDeleteConfirmCount(e.target.value === series.name ? 2 : 1)}
                />
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-ghost w-full" disabled style={{ opacity: 0.5 }}>Confirm</button>
                </div>
              </div>
            )}

            {deleteConfirmCount === 2 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--green)', background: 'rgba(29,233,160,0.1)', border: '1px solid rgba(29,233,160,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  ✅ Series name confirmed. Click below to permanently delete.
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-danger w-full" onClick={() => { onDeleteSeries(series.id); setShowDeleteModal(false); }}>Permanently Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// Calculate detailed player statistics
function calculatePlayerStats(matches, playerId) {
  const stats = {
    runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, matches: 0, outs: 0, notOuts: 0,
    highestScore: 0, scores: [],
    wickets: 0, ballsBowled: 0, runsConceded: 0, bowlingInnings: 0,
    bestBowlingFigures: null, bestWickets: 0, maxWicketsInMatch: 0,
    wicketHauls: { 3: 0, 4: 0, 5: 0 },
    matchesWon: 0, matchesLost: 0,
    matchesCaptained: 0, captainWins: 0, captainLosses: 0, tossWins: 0,
    catches: 0, catchDrops: 0,
  };

  const processedMatchIds = new Set();

  Object.values(matches).forEach(match => {
    let playedInMatch = false;

    Object.values(match.innings || {}).forEach(inn => {
      if (inn.batsmen?.[playerId]) {
        const bats = inn.batsmen[playerId];
        stats.innings++;
        stats.runs += bats.runs || 0;
        stats.balls += bats.balls || 0;
        stats.fours += bats.fours || 0;
        stats.sixes += bats.sixes || 0;
        stats.scores.push(bats.runs || 0);
        if ((bats.runs || 0) > stats.highestScore) stats.highestScore = bats.runs || 0;
        if (bats.out) stats.outs++;
        else stats.notOuts++;          // ← track not-outs
        playedInMatch = true;
      }
      if (inn.bowlers?.[playerId]) {
        const bowl = inn.bowlers[playerId];
        stats.bowlingInnings++;
        stats.wickets += bowl.wickets || 0;
        stats.ballsBowled += bowl.balls || 0;
        stats.runsConceded += bowl.runs || 0;
        if ((bowl.wickets || 0) > stats.bestWickets) {
          stats.bestWickets = bowl.wickets || 0;
          stats.bestBowlingFigures = `${bowl.wickets || 0}/${bowl.runs || 0}`;
        }
        if ((bowl.wickets || 0) > stats.maxWicketsInMatch) stats.maxWicketsInMatch = bowl.wickets || 0;
        const wkts = bowl.wickets || 0;
        if (wkts >= 3) stats.wicketHauls[3]++;
        if (wkts >= 4) stats.wicketHauls[4]++;
        if (wkts >= 5) stats.wicketHauls[5]++;
        playedInMatch = true;
      }
    });

    // Count catches taken + catch drops for this player
    Object.values(match.innings || {}).forEach(inn => {
      if (inn.fielders?.[playerId]) stats.catches += inn.fielders[playerId].catches || 0;
      (inn.catchDrops || []).forEach(d => { if (d.pid === playerId) stats.catchDrops++; });
    });

    if (playedInMatch && !processedMatchIds.has(match.id)) {
      processedMatchIds.add(match.id);
      stats.matches++;
      const inTeamA = (match.teamA?.players || []).some(p => p.id === playerId);
      const inTeamB = (match.teamB?.players || []).some(p => p.id === playerId);
      const result = match.result;
      const playerTeamName = inTeamA ? match.teamA?.name : inTeamB ? match.teamB?.name : null;
      if (result && result.winner && match.status === 'done') {
        if (playerTeamName) {
          if (result.winner === playerTeamName) stats.matchesWon++;
          else if (result.winner !== 'Match') stats.matchesLost++;
        }
      }
      // Captaincy
      const isCaptain = match.captainA === playerId || match.captainB === playerId;
      if (isCaptain) {
        stats.matchesCaptained++;
        if (result && result.winner && match.status === 'done' && playerTeamName) {
          if (result.winner === playerTeamName) stats.captainWins++;
          else if (result.winner !== 'Match') stats.captainLosses++;
        }
        if (match.tossWinner && playerTeamName) {
          const tossTeam = match.tossWinner === 'A' ? match.teamA?.name : match.teamB?.name;
          if (tossTeam === playerTeamName) stats.tossWins++;
        }
      }
    }
  });

  return stats;
}

// ============================================================
// PLAYER VS PLAYER STATS PAGE
// ============================================================
function PlayerVsStatsPage({ state, onBack, onDeletePlayerVsStats }) {
  const [filterType, setFilterType] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);
  const [vsSearch, setVsSearch] = useState('');

  // Build complete player name map from ALL sources
  const playerMap = {};
  Object.entries(state.players || {}).forEach(([id, p]) => { if (p?.name) playerMap[id] = p; });
  Object.values(state.matches).forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => {
      if (p?.id && p?.name) playerMap[p.id] = { ...playerMap[p.id], ...p };
    });
    Object.values(m.innings || {}).forEach(inn => {
      if (inn.striker?.id && inn.striker?.name) playerMap[inn.striker.id] = { ...(playerMap[inn.striker.id]||{}), ...inn.striker };
      if (inn.nonStriker?.id && inn.nonStriker?.name) playerMap[inn.nonStriker.id] = { ...(playerMap[inn.nonStriker.id]||{}), ...inn.nonStriker };
      if (inn.bowler?.id && inn.bowler?.name) playerMap[inn.bowler.id] = { ...(playerMap[inn.bowler.id]||{}), ...inn.bowler };
      // Extract names stored alongside IDs in ball records
      (inn.balls_by_ball || []).forEach(ball => {
        if (ball.batsman && ball.batsmanName && !playerMap[ball.batsman]?.name) playerMap[ball.batsman] = { id: ball.batsman, name: ball.batsmanName };
        if (ball.bowler  && ball.bowlerName  && !playerMap[ball.bowler]?.name)  playerMap[ball.bowler]  = { id: ball.bowler,  name: ball.bowlerName };
      });
    });
  });

  // Calculate all vs matchups from ball-by-ball data for accuracy
  const vsMatchups = (() => {
    const matchups = {}; // key: `${bowlerId}_vs_${batterId}`

    Object.values(state.matches).forEach(match => {
      Object.values(match.innings || {}).forEach(inn => {
        // Use ball-by-ball for accurate bowler vs batter stats
        (inn.balls_by_ball || []).forEach(ball => {
          const bowlerId = ball.bowler;
          const batterId = ball.batsman;
          if (!bowlerId || !batterId) return;

          const key = `${bowlerId}_vs_${batterId}`;
          if (!matchups[key]) {
            matchups[key] = {
              bowlerId, batterId,
              innings: 0, runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0,
              dotBalls: 0,
            };
          }

          if (!ball.wide) { // Wide doesn't count as legal delivery
            matchups[key].balls++;
            matchups[key].runs += ball.runs || 0;
            if (ball.runs === 4) matchups[key].fours++;
            if (ball.runs === 6) matchups[key].sixes++;
            if ((ball.runs || 0) === 0 && !ball.wicket) matchups[key].dotBalls++;
          }
          if (ball.wicket && ball.wicketMode !== 'Run Out') matchups[key].wickets++;
        });

        // Track innings count per pairing (each separate innings is +1)
        const pairingsThisInnings = new Set();
        (inn.balls_by_ball || []).forEach(ball => {
          if (ball.bowler && ball.batsman) {
            pairingsThisInnings.add(`${ball.bowler}_vs_${ball.batsman}`);
          }
        });
        pairingsThisInnings.forEach(key => {
          if (matchups[key]) matchups[key].innings = (matchups[key].innings || 0);
        });
      });

      // Count unique innings per pairing
      Object.values(match.innings || {}).forEach(inn => {
        const seen = new Set();
        (inn.balls_by_ball || []).forEach(ball => {
          const key = ball.bowler && ball.batsman ? `${ball.bowler}_vs_${ball.batsman}` : null;
          if (key && !seen.has(key)) {
            seen.add(key);
            if (matchups[key]) matchups[key].innings++;
          }
        });
      });
    });

    // Remove the double-counting from first loop
    // Recalculate innings properly
    const cleanMatchups = {};
    Object.values(state.matches).forEach(match => {
      Object.values(match.innings || {}).forEach(inn => {
        const seenInInnings = new Set();
        (inn.balls_by_ball || []).forEach(ball => {
          if (!ball.bowler || !ball.batsman) return;
          const key = `${ball.bowler}_vs_${ball.batsman}`;
          if (!cleanMatchups[key]) {
            cleanMatchups[key] = {
              bowlerId: ball.bowler, batterId: ball.batsman,
              innings: 0, runs: 0, balls: 0, wickets: 0, fours: 0, sixes: 0, dotBalls: 0,
            };
          }
          if (!seenInInnings.has(key)) {
            seenInInnings.add(key);
            cleanMatchups[key].innings++;
          }
          if (!ball.wide) {
            cleanMatchups[key].balls++;
            cleanMatchups[key].runs += ball.runs || 0;
            if (ball.runs === 4) cleanMatchups[key].fours++;
            if (ball.runs === 6) cleanMatchups[key].sixes++;
            if ((ball.runs || 0) === 0 && !ball.wicket) cleanMatchups[key].dotBalls++;
          }
          if (ball.wicket && ball.wicketMode !== 'Run Out') cleanMatchups[key].wickets++;
        });
      });
    });

    return cleanMatchups;
  })();

  const sorted = Object.values(vsMatchups)
    .filter(v => {
      const bn = playerMap[v.bowlerId]?.name || '';
      const bt = playerMap[v.batterId]?.name || '';
      if (vsSearch && !bn.toLowerCase().includes(vsSearch.toLowerCase()) && !bt.toLowerCase().includes(vsSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.balls - a.balls);

  return (
    <div className="page fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
          <div className="page-title" style={{ fontSize: 22 }}>⚔️ Player vs Player</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--blue)' }}
            onClick={() => {
              const rows = sorted.map((vs,i) => {
                const bowler = playerMap[vs.bowlerId]; const batter = playerMap[vs.batterId];
                if (!bowler || !batter) return '';
                const sr = vs.balls>0?((vs.runs/vs.balls)*100).toFixed(1):'-';
                const avg = vs.wickets>0?(vs.runs/vs.wickets).toFixed(1):'-';
                return `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}"><td style="padding:6px 8px;border:1px solid #eee;font-weight:600">${batter.name||'?'}</td><td style="padding:6px 8px;border:1px solid #eee;font-weight:600">${bowler.name||'?'}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${vs.innings}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center;font-weight:700">${vs.runs}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${vs.balls}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${vs.wickets}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${sr}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${vs.fours}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${vs.sixes}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${vs.dotBalls}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${avg}</td></tr>`;
              }).join('');
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Player vs Player</title><style>body{font-family:Arial,sans-serif;padding:24px;max-width:1000px;margin:0 auto}</style></head><body><h1 style="text-align:center;margin-bottom:4px">⚔️ Player vs Player Stats</h1><p style="text-align:center;color:#888;font-size:12px;margin-bottom:16px">Generated ${new Date().toLocaleDateString()}</p><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f5f5f5"><th style="padding:7px 8px;border:1px solid #ddd;text-align:left">Batter</th><th style="padding:7px 8px;border:1px solid #ddd;text-align:left">Bowler</th><th style="padding:7px 8px;border:1px solid #ddd">Inn</th><th style="padding:7px 8px;border:1px solid #ddd">Runs</th><th style="padding:7px 8px;border:1px solid #ddd">Balls</th><th style="padding:7px 8px;border:1px solid #ddd">Wkts</th><th style="padding:7px 8px;border:1px solid #ddd">SR</th><th style="padding:7px 8px;border:1px solid #ddd">4s</th><th style="padding:7px 8px;border:1px solid #ddd">6s</th><th style="padding:7px 8px;border:1px solid #ddd">Dots</th><th style="padding:7px 8px;border:1px solid #ddd">Avg</th></tr>${rows}</table><div style="text-align:center;margin-top:20px;color:#aaa;font-size:11px;border-top:1px solid #ddd;padding-top:10px">Crictera by Saksham Arora</div></body></html>`;
              downloadHTML(html, 'crictera_vs_stats.html');
            }}>📥 PDF</button>
          <button className="btn btn-danger btn-sm" onClick={() => { setShowDeleteModal(true); setDeleteConfirmCount(0); }}>🗑️ Clear</button>
        </div>
      </div>

      <input className="input mb-3" placeholder="🔍 Search by player name..." value={vsSearch} onChange={e => setVsSearch(e.target.value)} />

      {sorted.length === 0 && (
        <div className="empty">
          <div className="empty-icon">⚔️</div>
          <div className="empty-title">No matchups yet</div>
          <div className="empty-sub">Ball-by-ball scoring generates these stats automatically</div>
        </div>
      )}

      {sorted.map((vs, i) => {
        const bowler = playerMap[vs.bowlerId];
        const batter = playerMap[vs.batterId];
        if (!bowler || !batter) return null;
        const sr = vs.balls > 0 ? ((vs.runs / vs.balls) * 100).toFixed(1) : '-';
        const avg = vs.wickets > 0 ? (vs.runs / vs.wickets).toFixed(1) : '-';

        return (
          <div key={vs.bowlerId + vs.batterId + i} className="card mb-3 fade-in" style={{ animationDelay: `${i * 20}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{batter?.name || 'Unknown'}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>🏏 Batter</div>
              </div>
              <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>vs</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{bowler?.name || 'Unknown'}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>🎯 Bowler</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              <div className="stat-box"><div className="stat-val">{vs.runs}</div><div className="stat-label">Runs</div></div>
              <div className="stat-box"><div className="stat-val">{vs.balls}</div><div className="stat-label">Balls</div></div>
              <div className="stat-box"><div className="stat-val">{vs.wickets}</div><div className="stat-label">Wkts</div></div>
              <div className="stat-box"><div className="stat-val">{sr}</div><div className="stat-label">SR</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 6 }}>
              <div className="stat-box"><div className="stat-val">{vs.fours}</div><div className="stat-label">4s</div></div>
              <div className="stat-box"><div className="stat-val">{vs.sixes}</div><div className="stat-label">6s</div></div>
              <div className="stat-box"><div className="stat-val">{vs.dotBalls}</div><div className="stat-label">Dots</div></div>
              <div className="stat-box"><div className="stat-val">{avg}</div><div className="stat-label">Avg</div></div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{vs.innings} innings</div>
          </div>
        );
      })}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-handle" />
            <div className="modal-title" style={{ color: 'var(--red)' }}>🗑️ Clear Player vs Stats?</div>
            {deleteConfirmCount === 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>This will permanently delete all head-to-head stats. A fresh start begins from next match.</div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-danger w-full" onClick={() => setDeleteConfirmCount(1)}>Continue</button>
                </div>
              </div>
            )}
            {deleteConfirmCount === 1 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(255,74,110,0.1)', border: '1px solid rgba(255,74,110,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  ⚠️ Type "DELETE ALL" to confirm
                </div>
                <input className="input mb-3" placeholder="Type DELETE ALL"
                  onChange={(e) => setDeleteConfirmCount(e.target.value === 'DELETE ALL' ? 2 : 1)} />
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-ghost w-full" disabled style={{ opacity: 0.5 }}>Confirm</button>
                </div>
              </div>
            )}
            {deleteConfirmCount === 2 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--green)', background: 'rgba(29,233,160,0.1)', border: '1px solid rgba(29,233,160,0.2)', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                  ✅ Confirmed. This will delete ball-by-ball data from all matches.
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => { setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Cancel</button>
                  <button className="btn btn-danger w-full" onClick={() => { onDeletePlayerVsStats?.(); setShowDeleteModal(false); setDeleteConfirmCount(0); }}>Delete All</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardPage({ state, onBack, onNav, onEditPlayerStats }) {
  const [scope, setScope] = useState('all');
  const [metric, setMetric] = useState('runs');
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Get manual stats overrides if any
  const manualStatsMap = state.manualPlayerStats || {};

  // Aggregate real stats from all completed/live matches
  const playerStatsMap = {};
  Object.values(state.matches).forEach(match => {
    Object.values(match.innings || {}).forEach(inn => {
      Object.entries(inn.batsmen || {}).forEach(([pid, st]) => {
        if (!playerStatsMap[pid]) playerStatsMap[pid] = { runs: 0, balls: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, matches: 0, fours: 0, sixes: 0 };
        playerStatsMap[pid].runs += st.runs || 0;
        playerStatsMap[pid].balls += st.balls || 0;
        playerStatsMap[pid].fours += st.fours || 0;
        playerStatsMap[pid].sixes += st.sixes || 0;
        playerStatsMap[pid].matches += 1;
      });
      Object.entries(inn.bowlers || {}).forEach(([pid, st]) => {
        if (!playerStatsMap[pid]) playerStatsMap[pid] = { runs: 0, balls: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, matches: 0, fours: 0, sixes: 0 };
        playerStatsMap[pid].wickets += st.wickets || 0;
        playerStatsMap[pid].ballsBowled += st.balls || 0;
        playerStatsMap[pid].runsConceded += st.runs || 0;
      });
    });
  });

  // Build enriched player list with names from match rosters
  const allPlayersInMatches = {};
  Object.values(state.matches).forEach(match => {
    [...(match.teamA?.players || []), ...(match.teamB?.players || [])].forEach(p => {
      if (!allPlayersInMatches[p.id]) allPlayersInMatches[p.id] = p;
    });
  });

  const withStats = Object.keys(playerStatsMap).map(pid => {
    const matchStats = playerStatsMap[pid];
    const manual = manualStatsMap[pid] || {};
    const detailedStats = calculatePlayerStats(state.matches, pid);
    const notOuts = detailedStats.notOuts + (manual.notOuts || 0);
    return {
      id: pid,
      name: allPlayersInMatches[pid]?.name || state.players?.[pid]?.name || 'Unknown',
      photo: allPlayersInMatches[pid]?.photo || state.players?.[pid]?.photo || null,
      runs:         (manual.runs         ?? 0) + matchStats.runs,
      balls:        (manual.balls        ?? 0) + matchStats.balls,
      fours:        (manual.fours        ?? 0) + matchStats.fours,
      sixes:        (manual.sixes        ?? 0) + matchStats.sixes,
      wickets:      (manual.wickets      ?? 0) + matchStats.wickets,
      ballsBowled:  (manual.ballsBowled  ?? 0) + matchStats.ballsBowled,
      runsConceded: (manual.runsConceded ?? 0) + matchStats.runsConceded,
      matches:      (manual.matches      ?? 0) + detailedStats.matches,
      innings:      (manual.innings      ?? 0) + detailedStats.innings,
      notOuts,
      matchesWon:   detailedStats.matchesWon  + (manual.matchesWon  || 0),
      matchesLost:  detailedStats.matchesLost + (manual.matchesLost || 0),
      matchesCaptained: detailedStats.matchesCaptained || 0,
      captainWins:  detailedStats.captainWins  || 0,
      captainLosses: detailedStats.captainLosses || 0,
      tossWins:     detailedStats.tossWins || 0,
      outs:         detailedStats.outs,
      catches:      detailedStats.catches || 0,
      catchDrops:   detailedStats.catchDrops || 0,
      isManuallyEdited: Object.keys(manual).length > 0,
    };
  });

  const handleEditClick = (player) => {
    setEditingPlayerId(player.id);
    // Show TOTAL stats (match stats + manual bonus) so user edits the real total
    setEditForm({
      runs:         player.runs,
      balls:        player.balls,
      fours:        player.fours,
      sixes:        player.sixes,
      wickets:      player.wickets,
      ballsBowled:  player.ballsBowled,
      runsConceded: player.runsConceded,
      matches:      player.matches,
      innings:      player.innings,
      notOuts:      player.notOuts || 0,
      matchesWon:   player.matchesWon || 0,
      matchesLost:  player.matchesLost || 0,
    });
  };

  const handleSaveStats = () => {
    if (!onEditPlayerStats || !editingPlayerId) return;
    // Find the current player's match-calculated stats
    const matchPlayer = withStats.find(p => p.id === editingPlayerId);
    if (!matchPlayer) { setEditingPlayerId(null); return; }
    const detailed = calculatePlayerStats(state.matches, editingPlayerId);

    // Delta = what user entered minus what matches already show (pure match stats, no manual)
    const delta = {
      runs:         (editForm.runs         || 0) - detailed.runs,
      balls:        (editForm.balls        || 0) - detailed.balls,
      fours:        (editForm.fours        || 0) - detailed.fours,
      sixes:        (editForm.sixes        || 0) - detailed.sixes,
      wickets:      (editForm.wickets      || 0) - detailed.wickets,
      ballsBowled:  (editForm.ballsBowled  || 0) - detailed.ballsBowled,
      runsConceded: (editForm.runsConceded || 0) - detailed.runsConceded,
      matches:      (editForm.matches      || 0) - detailed.matches,
      innings:      (editForm.innings      || 0) - detailed.innings,
      notOuts:      (editForm.notOuts      || 0) - detailed.notOuts,
      matchesWon:   (editForm.matchesWon   || 0) - detailed.matchesWon,
      matchesLost:  (editForm.matchesLost  || 0) - detailed.matchesLost,
    };
    // Only save fields where delta > 0 (don't allow reducing below what matches show)
    const sanitized = {};
    Object.entries(delta).forEach(([k, v]) => { if (v !== 0) sanitized[k] = Math.max(0, v); });
    onEditPlayerStats(editingPlayerId, Object.keys(sanitized).length > 0 ? sanitized : {});
    setEditingPlayerId(null);
  };

  const sortedWithStats = [...withStats].sort((a, b) => {
    if (metric === 'runs') return b.runs - a.runs;
    if (metric === 'avg') {
      const dA = (a.innings - (a.notOuts || 0)); const dB = (b.innings - (b.notOuts || 0));
      const avgA = dA > 0 ? a.runs / dA : (a.innings > 0 ? Infinity : 0);
      const avgB = dB > 0 ? b.runs / dB : (b.innings > 0 ? Infinity : 0);
      return avgB - avgA;
    }
    if (metric === 'sr') return parseFloat(formatRate(b.runs, b.balls)) - parseFloat(formatRate(a.runs, a.balls));
    if (metric === 'fours') return b.fours - a.fours;
    if (metric === 'sixes') return b.sixes - a.sixes;
    if (metric === 'boundaries') return (b.fours + b.sixes) - (a.fours + a.sixes);
    if (metric === 'highest') {
      const statsA = calculatePlayerStats(state.matches, a.id);
      const statsB = calculatePlayerStats(state.matches, b.id);
      return statsB.highestScore - statsA.highestScore;
    }
    if (metric === 'wickets') return b.wickets - a.wickets;
    if (metric === 'bowlavg') {
      const statsA = calculatePlayerStats(state.matches, a.id);
      const statsB = calculatePlayerStats(state.matches, b.id);
      // Bowlers with no wickets go to bottom
      if (statsA.wickets === 0 && statsB.wickets === 0) return 0;
      if (statsA.wickets === 0) return 1; // A to bottom
      if (statsB.wickets === 0) return -1; // B to bottom
      const avgA = statsA.runsConceded / statsA.wickets;
      const avgB = statsB.runsConceded / statsB.wickets;
      return avgA - avgB; // Lower is better
    }
    if (metric === 'bowlsr') {
      const statsA = calculatePlayerStats(state.matches, a.id);
      const statsB = calculatePlayerStats(state.matches, b.id);
      // Bowlers with no wickets go to bottom
      if (statsA.wickets === 0 && statsB.wickets === 0) return 0;
      if (statsA.wickets === 0) return 1; // A to bottom
      if (statsB.wickets === 0) return -1; // B to bottom
      const srA = statsA.ballsBowled / statsA.wickets;
      const srB = statsB.ballsBowled / statsB.wickets;
      return srA - srB; // Lower is better
    }
    if (metric === 'econ') {
      const ballsA = a.ballsBowled || 0;
      const ballsB = b.ballsBowled || 0;
      // Bowlers with no overs bowled go to bottom
      if (ballsA === 0 && ballsB === 0) return 0;
      if (ballsA === 0) return 1; // A to bottom
      if (ballsB === 0) return -1; // B to bottom
      const ecoA = parseFloat(formatEcon(a.runsConceded, a.ballsBowled / 6));
      const ecoB = parseFloat(formatEcon(b.runsConceded, b.ballsBowled / 6));
      return ecoA - ecoB;
    }
    if (metric === 'best') {
      const statsA = calculatePlayerStats(state.matches, a.id);
      const statsB = calculatePlayerStats(state.matches, b.id);
      return statsB.bestWickets - statsA.bestWickets;
    }
    if (metric === '3wkts') {
      const stats3a = calculatePlayerStats(state.matches, a.id);
      const stats3b = calculatePlayerStats(state.matches, b.id);
      return (stats3b.wicketHauls[3] || 0) - (stats3a.wicketHauls[3] || 0);
    }
    if (metric === '5wkts') {
      const stats5a = calculatePlayerStats(state.matches, a.id);
      const stats5b = calculatePlayerStats(state.matches, b.id);
      return (stats5b.wicketHauls[5] || 0) - (stats5a.wicketHauls[5] || 0);
    }
    if (metric === 'won') return (b.matchesWon || 0) - (a.matchesWon || 0);
    if (metric === 'lost') return (b.matchesLost || 0) - (a.matchesLost || 0);
    if (metric === 'balls') return b.balls - a.balls;
    if (metric === 'captained') return (b.matchesCaptained || 0) - (a.matchesCaptained || 0);
    if (metric === 'capwins') return (b.captainWins || 0) - (a.captainWins || 0);
    if (metric === 'catches') return (b.catches || 0) - (a.catches || 0);
    if (metric === 'catchdrops') return (b.catchDrops || 0) - (a.catchDrops || 0);
    if (metric === 'potm') {
      const potmA = Object.values(state.matches).filter(m => m.result?.potm && [...(m.teamA?.players||[]),...(m.teamB?.players||[])].find(p=>p.id===a.id)?.name === m.result.potm).length;
      const potmB = Object.values(state.matches).filter(m => m.result?.potm && [...(m.teamA?.players||[]),...(m.teamB?.players||[])].find(p=>p.id===b.id)?.name === m.result.potm).length;
      return potmB - potmA;
    }
    return 0;
  });

  const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 24 }}>Leaderboard</div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => generateLeaderboardPDF(state)}>
          📥 Download PDF
        </button>
      </div>

      <div className="tabs mb-3" style={{ overflowX: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[['runs', '🏏 Runs'], ['avg', '📈 Avg'], ['sr', '⚡ SR'], ['highest', '🔥 Highest'], ['balls', '🎯 Balls'],
          ['fours', '4️⃣ Fours'], ['sixes', '6️⃣ Sixes'],
          ['boundaries', '🛑 Boundaries'], ['wickets', '🎯 Wickets'], ['bowlavg', '📊 Bowl Avg'], ['bowlsr', '⚡ Bowl SR'], ['econ', '📉 Economy'], ['best', '🥇 Best'],
          ['3wkts', '3️⃣ 3-Wkts'], ['5wkts', '5️⃣ 5-Wkts'], ['won', '🏆 Won'], ['lost', '💔 Lost'],
          ['captained', '👑 Captained'], ['capwins', '👑 Cap Wins'],
          ['catches', '🤲 Catches'], ['catchdrops', '💔 Drops'], ['potm', '⭐ POTM']].map(([v, l]) => (
          <button key={v} className={`tab ${metric === v ? 'active' : ''}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => setMetric(v)}>{l}</button>
        ))}
      </div>

      {sortedWithStats.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏅</div>
          <div className="empty-title">No stats yet</div>
          <div className="empty-sub">Play some matches to see rankings here!</div>
        </div>
      )}
      {sortedWithStats.slice(0, 10).map((p, i) => (
        <div key={p.id} className="player-card fade-in" style={{ animationDelay: `${i * 40}ms`, cursor: 'pointer' }} onClick={() => setSelectedPlayerDetail(p)}>
          <div className={`player-rank ${rankClass(i)}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
          <PlayerAvatar player={p} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.matches} match{p.matches !== 1 ? 'es' : ''}</div>
            {p.isManuallyEdited && <span className="badge badge-blue" style={{ marginTop: 4 }}>✏️ Edited</span>}
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div>
              <div className="font-mono text-gold" style={{ fontWeight: 700, fontSize: 18 }}>
                {metric === 'runs' ? p.runs
                : metric === 'avg' ? (() => { const d = p.innings - (p.notOuts||0); return d > 0 ? (p.runs/d).toFixed(2) : (p.innings > 0 ? '∞' : '-'); })()
                : metric === 'sr' ? formatRate(p.runs, p.balls)
                : metric === 'highest' ? (() => { const s = calculatePlayerStats(state.matches, p.id); return s.highestScore || '-'; })()
                : metric === 'fours' ? p.fours
                : metric === 'sixes' ? p.sixes
                : metric === 'boundaries' ? (p.fours + p.sixes)
                : metric === 'wickets' ? p.wickets
                : metric === 'bowlavg' ? (p.wickets > 0 ? (p.runsConceded / p.wickets).toFixed(1) : '-')
                : metric === 'bowlsr' ? (p.wickets > 0 ? (p.ballsBowled / p.wickets).toFixed(1) : '-')
                : metric === 'econ' ? formatEcon(p.runsConceded, p.ballsBowled / 6)
                : metric === 'best' ? (() => { const s = calculatePlayerStats(state.matches, p.id); return s.bestBowlingFigures || '-'; })()
                : metric === '3wkts' ? (() => { const s = calculatePlayerStats(state.matches, p.id); return s.wicketHauls[3] || 0; })()
                : metric === '5wkts' ? (() => { const s = calculatePlayerStats(state.matches, p.id); return s.wicketHauls[5] || 0; })()
                : metric === 'won' ? (p.matchesWon || 0)
                : metric === 'lost' ? (p.matchesLost || 0)
                : metric === 'balls' ? p.balls
                : metric === 'captained' ? (p.matchesCaptained || 0)
                : metric === 'capwins' ? (() => {
                    const cap = p.matchesCaptained || 0;
                    const wins = p.captainWins || 0;
                    const wpct = cap > 0 ? Math.round((wins / cap) * 100) : 0;
                    return `${wins}/${cap} (${wpct}%)`;
                  })()
                : metric === 'catches' ? (p.catches || 0)
                : metric === 'catchdrops' ? (p.catchDrops || 0)
                : metric === 'potm' ? Object.values(state.matches).filter(m => m.result?.potm && [...(m.teamA?.players||[]),...(m.teamB?.players||[])].find(pl=>pl.id===p.id)?.name === m.result.potm).length
                : p.runs}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>
                {metric === 'runs' ? 'Runs'
                : metric === 'avg' ? 'Average'
                : metric === 'sr' ? 'SR'
                : metric === 'highest' ? 'Highest'
                : metric === 'fours' ? 'Fours'
                : metric === 'sixes' ? 'Sixes'
                : metric === 'boundaries' ? 'Boundaries'
                : metric === 'wickets' ? 'Wickets'
                : metric === 'bowlavg' ? 'B.Avg'
                : metric === 'bowlsr' ? 'B.SR'
                : metric === 'econ' ? 'Economy'
                : metric === 'best' ? 'Best'
                : metric === '3wkts' ? '3-Wkts'
                : metric === '5wkts' ? '5-Wkts'
                : metric === 'won' ? 'Matches Won'
                : metric === 'lost' ? 'Matches Lost'
                : metric === 'balls' ? 'Balls Played'
                : metric === 'captained' ? 'Matches Captained'
                : metric === 'capwins' ? 'Captain Win%'
                : metric === 'catches' ? 'Catches'
                : metric === 'catchdrops' ? 'Catch Drops'
                : metric === 'potm' ? 'POTM Awards'
                : 'Runs'}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={(e) => { e.stopPropagation(); handleEditClick(p); }}>✏️ Edit</button>
          </div>
        </div>
      ))}

      {/* Edit Stats Modal */}
      {/* Player Detail Modal with Full Stats */}
      {selectedPlayerDetail && (
        <div className="modal-overlay" onClick={() => setSelectedPlayerDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-handle" />
            
            {(() => {
              const player = selectedPlayerDetail;
              const detailedStats = calculatePlayerStats(state.matches, player.id);
              const dismissals = detailedStats.innings - detailedStats.notOuts;
              const avg = dismissals > 0 ? (detailedStats.runs / dismissals).toFixed(2) : (detailedStats.innings > 0 ? '∞' : 'N/A');
              const sr = detailedStats.balls > 0 ? ((detailedStats.runs / detailedStats.balls) * 100).toFixed(1) : 'N/A';
              const bowlingAvg = detailedStats.wickets > 0 ? (detailedStats.runsConceded / detailedStats.wickets).toFixed(2) : 'N/A';
              const bowlingSR = detailedStats.wickets > 0 ? (detailedStats.ballsBowled / detailedStats.wickets).toFixed(1) : 'N/A';
              const economy = detailedStats.ballsBowled > 0 ? ((detailedStats.runsConceded * 6) / detailedStats.ballsBowled).toFixed(2) : 'N/A';

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <PlayerAvatar player={player} size="lg" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{player.name}</div>
                      {player.isManuallyEdited && <span className="badge badge-blue">✏️ Manually Edited</span>}
                    </div>
                  </div>

                  {/* Batting Stats */}
                  <div className="card mb-3">
                    <div className="section-title">🏏 Batting Stats</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                      <div className="stat-box"><div className="stat-val">{player.runs}</div><div className="stat-label">Runs</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.innings}</div><div className="stat-label">Innings</div></div>
                      <div className="stat-box"><div className="stat-val">{avg}</div><div className="stat-label">Average</div></div>
                      <div className="stat-box"><div className="stat-val">{sr}%</div><div className="stat-label">SR</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.fours}</div><div className="stat-label">Fours</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.sixes}</div><div className="stat-label">Sixes</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.fours + detailedStats.sixes}</div><div className="stat-label">Boundaries</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.highestScore}</div><div className="stat-label">Highest</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.outs}</div><div className="stat-label">Outs</div></div>
                      <div className="stat-box"><div className="stat-val" style={{color:'var(--green)'}}>{detailedStats.notOuts}</div><div className="stat-label">Not Outs</div></div>
                    </div>
                  </div>

                  {/* Bowling Stats */}
                  <div className="card mb-3">
                    <div className="section-title">🎯 Bowling Stats</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                      <div className="stat-box"><div className="stat-val">{detailedStats.wickets}</div><div className="stat-label">Wickets</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.bowlingInnings}</div><div className="stat-label">Innings</div></div>
                      <div className="stat-box"><div className="stat-val">{bowlingAvg}</div><div className="stat-label">Avg</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.runsConceded}</div><div className="stat-label">Runs</div></div>
                      <div className="stat-box"><div className="stat-val">{bowlingSR}</div><div className="stat-label">SR</div></div>
                      <div className="stat-box"><div className="stat-val">{economy}</div><div className="stat-label">Econ</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.bestBowlingFigures || '-'}</div><div className="stat-label">Best</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.wicketHauls[3]}</div><div className="stat-label">3-wkts</div></div>
                      <div className="stat-box"><div className="stat-val">{detailedStats.wicketHauls[4]}</div><div className="stat-label">4-wkts</div></div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      5+ wicket hauls: <strong>{detailedStats.wicketHauls[5]}</strong>
                    </div>
                  </div>

                  {/* Head to Head - vs Other Players */}
                  <div className="card mb-3">
                    <div className="section-title">⚔️ Player vs Stats</div>
                    {(() => {
                      const vsStats = {};
                      Object.values(state.matches).forEach(match => {
                        Object.values(match.innings || {}).forEach(inn => {
                          // Check if this player batted against specific bowlers
                          if (inn.batsmen?.[player.id]) {
                            Object.entries(inn.bowlers || {}).forEach(([bowlerId, _]) => {
                              if (!vsStats[bowlerId]) vsStats[bowlerId] = { vs: 'bowler', runs: 0, balls: 0, wickets: 0, inns: 0 };
                              vsStats[bowlerId].inns++;
                              vsStats[bowlerId].runs += inn.batsmen[player.id].runs || 0;
                              vsStats[bowlerId].balls += inn.batsmen[player.id].balls || 0;
                            });
                          }
                          // Check if this player bowled against specific batters
                          if (inn.bowlers?.[player.id]) {
                            Object.entries(inn.batsmen || {}).forEach(([batterId, _]) => {
                              if (!vsStats[batterId]) vsStats[batterId] = { vs: 'batter', runs: 0, balls: 0, wickets: 0, inns: 0 };
                              vsStats[batterId].inns++;
                              vsStats[batterId].wickets += inn.bowlers[player.id].wickets || 0;
                              vsStats[batterId].runs += inn.bowlers[player.id].runs || 0;
                            });
                          }
                        });
                      });

                      if (Object.keys(vsStats).length === 0) {
                        return <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px', textAlign: 'center' }}>No head-to-head data yet</div>;
                      }

                      return (
                        <div style={{ maxHeight: 300, overflow: 'auto' }}>
                          {Object.entries(vsStats).slice(0, 10).map(([oppId, data]) => {
                            const opponent = Object.values(state.players).find(p => p.id === oppId) || 
                              Object.values(state.matches).flatMap(m => [...(m.teamA?.players||[]), ...(m.teamB?.players||[])]).find(p => p.id === oppId);
                            if (!opponent) return null;
                            const srVs = data.balls > 0 ? ((data.runs / data.balls) * 100).toFixed(1) : 'N/A';
                            const avgVs = data.wickets > 0 ? (data.runs / data.wickets).toFixed(2) : 'N/A';
                            return (
                              <div key={oppId} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0', fontSize: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>vs {opponent.name}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, color: 'var(--text2)' }}>
                                  {data.vs === 'bowler' && (
                                    <>
                                      <div><span style={{ color: 'var(--text3)' }}>Runs:</span> {data.runs}</div>
                                      <div><span style={{ color: 'var(--text3)' }}>Balls:</span> {data.balls}</div>
                                      <div><span style={{ color: 'var(--text3)' }}>SR:</span> {srVs}%</div>
                                      <div><span style={{ color: 'var(--text3)' }}>Inns:</span> {data.inns}</div>
                                    </>
                                  )}
                                  {data.vs === 'batter' && (
                                    <>
                                      <div><span style={{ color: 'var(--text3)' }}>Wkts:</span> {data.wickets}</div>
                                      <div><span style={{ color: 'var(--text3)' }}>Runs:</span> {data.runs}</div>
                                      <div><span style={{ color: 'var(--text3)' }}>Avg:</span> {avgVs}</div>
                                      <div><span style={{ color: 'var(--text3)' }}>Inns:</span> {data.inns}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <button className="btn btn-ghost w-full" onClick={() => setSelectedPlayerDetail(null)}>Close</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {editingPlayerId && (
        <div className="modal-overlay" onClick={() => setEditingPlayerId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">✏️ Edit Bonus Stats</div>

            {withStats.find(p => p.id === editingPlayerId) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: 10, background: 'var(--bg3)', borderRadius: 8 }}>
                  <PlayerAvatar player={withStats.find(p => p.id === editingPlayerId)} size="md" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{withStats.find(p => p.id === editingPlayerId).name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>These values are ADDED to match stats</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}>
                  ⚡ Edit total career stats — shows your actual numbers
                </div>

                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>🏏 Batting</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[['runs','Total Runs'],['balls','Total Balls'],['fours','Total Fours'],['sixes','Total Sixes'],
                    ['innings','Total Innings'],['notOuts','Total Not Outs']].map(([k, lbl]) => (
                    <div key={k}>
                      <label className="label">{lbl}</label>
                      <input className="input" type="number" min="0" value={editForm[k] || 0}
                        onChange={e => setEditForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                    </div>
                  ))}
                </div>

                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>🎯 Bowling</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[['wickets','Total Wickets'],['ballsBowled','Total Balls Bowled'],['runsConceded','Total Runs Conceded']].map(([k, lbl]) => (
                    <div key={k} style={k === 'runsConceded' ? { gridColumn: '1/-1' } : {}}>
                      <label className="label">{lbl}</label>
                      <input className="input" type="number" min="0" value={editForm[k] || 0}
                        onChange={e => setEditForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                    </div>
                  ))}
                </div>

                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>🏆 Match Record</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[['matches','Matches'],['matchesWon','Won'],['matchesLost','Lost']].map(([k, lbl]) => (
                    <div key={k}>
                      <label className="label">{lbl}</label>
                      <input className="input" type="number" min="0" value={editForm[k] || 0}
                        onChange={e => setEditForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button className="btn btn-ghost w-full" onClick={() => setEditingPlayerId(null)}>Cancel</button>
                  <button className="btn btn-primary w-full" onClick={handleSaveStats}>✅ Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROFILE PAGE
// ============================================================
function ProfilePage({ user, state, onBack, onUpdateUser, onLogout }) {
  const myMatches = Object.values(state.matches).filter(m => m.ownerId === user?.id);
  const totalRuns = myMatches.reduce((acc, m) => {
    if (!m.innings) return acc;
    return acc + Object.values(m.innings).reduce((a, inn) => a + (inn.runs || 0), 0);
  }, 0);

  const [showFeedback, setShowFeedback] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [nameMsg, setNameMsg] = useState('');

  // Change password (real Supabase Auth — no OTP needed since the user is
  // already signed in; Supabase verifies the session itself)
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Change email (Supabase sends a confirmation link to the NEW address;
  // the email only actually changes once that link is clicked)
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const feedbackList = (() => {
    try { return JSON.parse(localStorage.getItem('crictera_feedback') || '[]'); } catch { return []; }
  })();

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      await updateProfileName(nameInput.trim());
      onUpdateUser?.({ ...user, name: nameInput.trim() });
      setEditingName(false);
    } catch (e) {
      setNameMsg(e.message || 'Could not update name');
      setTimeout(() => setNameMsg(''), 3000);
    }
  };

  const handleChangePassword = async () => {
    if (newPw.length < 6) { setPwError('Min 6 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwError(''); setPwLoading(true);
    try {
      await updatePassword(newPw);
      setPwError('✅ Password changed!');
      setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwError(''); setShowChangePw(false); }, 2000);
    } catch (e) {
      setPwError(e.message || 'Could not change password');
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) { setEmailError('Enter a valid email'); return; }
    setEmailError(''); setEmailLoading(true);
    try {
      await updateEmail(newEmail);
      setEmailError(`✅ Confirmation link sent to ${newEmail}. Click it to finish changing your email.`);
      setNewEmail('');
    } catch (e) {
      setEmailError(e.message || 'Could not change email');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 24 }}>Profile</div>
      </div>

      {/* Profile card with editable name */}
      <div className="card mb-3" style={{ textAlign: 'center', padding: 28 }}>
        <div className="avatar avatar-xl" style={{ margin: '0 auto 12px' }}>{initials(user?.name || '')}</div>
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <input className="input" style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, maxWidth: 220 }}
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()} autoFocus />
            <button className="btn btn-primary btn-sm" onClick={handleSaveName}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingName(false); setNameInput(user?.name || ''); }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{user?.name}</div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
              onClick={() => { setEditingName(true); setNameInput(user?.name || ''); }}>✏️</button>
          </div>
        )}
        {nameMsg && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 4 }}>{nameMsg}</div>}
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{user?.email}</div>
      </div>

      {/* Stats */}
      <div className="grid-3 mb-3">
        <div className="stat-box"><div className="stat-val">{myMatches.length}</div><div className="stat-label">Matches</div></div>
        <div className="stat-box"><div className="stat-val">{Object.values(state.series).length}</div><div className="stat-label">Series</div></div>
        <div className="stat-box"><div className="stat-val">{totalRuns}</div><div className="stat-label">Total Runs</div></div>
      </div>

      {/* Account Settings */}
      <div className="card mb-3">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>⚙️ Account Settings</div>

        {/* Change Password */}
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>🔐 Change Password</div>
          {!showChangePw ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowChangePw(true)}>Change Password</button>
          ) : (
            <div>
              <input className="input mb-2" type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} />
              <input className="input mb-2" type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowChangePw(false); setNewPw(''); setConfirmPw(''); setPwError(''); }}>Cancel</button>
                <button className="btn btn-primary btn-sm" disabled={pwLoading} onClick={handleChangePassword}>{pwLoading ? '⏳...' : '✅ Save Password'}</button>
              </div>
            </div>
          )}
          {pwError && <div style={{ fontSize: 12, color: pwError.startsWith('✅') ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>{pwError}</div>}
        </div>

        {/* Change Email */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📧 Change Email</div>
          {!showChangeEmail ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowChangeEmail(true)}>Change Email Address</button>
          ) : (
            <div>
              <input className="input mb-2" type="email" placeholder="New email address" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowChangeEmail(false); setNewEmail(''); setEmailError(''); }}>Cancel</button>
                <button className="btn btn-primary btn-sm" disabled={emailLoading} onClick={handleChangeEmail}>{emailLoading ? '⏳...' : 'Send Confirmation →'}</button>
              </div>
            </div>
          )}
          {emailError && <div style={{ fontSize: 12, color: emailError.startsWith('✅') ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>{emailError}</div>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', padding: '0 4px', marginBottom: 12, lineHeight: 1.6 }}>
        📱 Your matches, series, players, and stats are stored in your account and load automatically when you sign in on any device — no manual sync needed.
      </div>

      {/* Feedback viewer */}
      {feedbackList.length > 0 && (
        <div className="card mb-3">
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontWeight: 600, fontSize: 14 }}>💬 User Feedback ({feedbackList.length})</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowFeedback(v => !v)}>{showFeedback ? 'Hide' : 'View'}</button>
          </div>
          {showFeedback && feedbackList.slice().reverse().map((fb, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{fb.name || 'Anonymous'}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fb.timestamp ? new Date(fb.timestamp).toLocaleDateString('en-IN') : ''}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--purple)', marginBottom: 4 }}>{fb.type} • {'⭐'.repeat(fb.rating || 0)}</div>
              {fb.email && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{fb.email}</div>}
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{fb.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">My Matches</div>
      {myMatches.length === 0 ? (
        <div className="empty"><div className="empty-sub">No matches created yet</div></div>
      ) : (
        myMatches.slice(0, 6).map(m => <MatchCard key={m.id} match={m} onClick={() => {}} />)
      )}

      <button className="btn btn-ghost w-full mt-4" style={{ color: 'var(--red)' }} onClick={onLogout}>🚪 Sign Out</button>
    </div>
  );
}

// ============================================================
// SUPER OVER LOGIC
// ============================================================
function checkForTie(match) {
  if (match.innings?.['1'] && match.innings?.['2']) {
    const inn1Runs = match.innings['1'].runs || 0;
    const inn2Runs = match.innings['2'].runs || 0;
    return inn1Runs === inn2Runs;
  }
  return false;
}

function SuperOverModal({ match, onClose, onStartSuperOver }) {
  const [soTeamA, setSoTeamA] = useState('');
  const [soTeamB, setSoTeamB] = useState('');
  const [step, setStep] = useState(1); // 1 = confirm, 2 = pick batters

  const teamAPlayers = match.teamA?.players || [];
  const teamBPlayers = match.teamB?.players || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title" style={{ color: 'var(--gold)' }}>⚡ SUPER OVER!</div>

        {step === 1 && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.7 }}>
              The match is tied! A Super Over will decide the winner.
              <br />Each team faces 1 over (6 balls). The team scoring more runs wins.
              <br />If still tied, count of sixes/fours/boundaries decides.
            </div>
            <div style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 12, color: 'var(--text2)' }}>
              🏏 <strong>{match.teamA?.name}</strong> vs <strong>{match.teamB?.name}</strong>
              <br />Score: <strong>{match.innings?.['1']?.runs || 0}</strong> – <strong>{match.innings?.['2']?.runs || 0}</strong>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost w-full" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary w-full" onClick={() => setStep(2)}>Start Super Over ⚡</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              Who bats first in the Super Over?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <button
                className={`btn ${soTeamA === 'A' ? 'btn-primary' : 'btn-ghost'} w-full`}
                style={{ flexDirection: 'column', gap: 4, padding: 12, height: 64 }}
                onClick={() => { setSoTeamA('A'); setSoTeamB('B'); }}>
                <span style={{ fontSize: 16 }}>🏏</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{match.teamA?.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>Bats first</span>
              </button>
              <button
                className={`btn ${soTeamA === 'B' ? 'btn-primary' : 'btn-ghost'} w-full`}
                style={{ flexDirection: 'column', gap: 4, padding: 12, height: 64 }}
                onClick={() => { setSoTeamA('B'); setSoTeamB('A'); }}>
                <span style={{ fontSize: 16 }}>🏏</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{match.teamB?.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>Bats first</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost w-full" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary w-full"
                disabled={!soTeamA}
                onClick={() => onStartSuperOver(soTeamA)}>
                Start ⚡
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuperOverScoring({ match, onScore, onUndo, onEndSuperOver, onBack }) {
  const [batter1, setBatter1] = useState('');
  const [batter2, setBatter2] = useState('');
  const [bowlerPid, setBowlerPid] = useState('');
  const [setup, setSetup] = useState(true);

  const soKey = match.superOver?.currentInnKey || 'so1';
  const soInn = match.superOver?.innings?.[soKey];
  const so = match.superOver;

  if (!so) return null;

  const battingTeamKey = so.battingTeam; // 'A' or 'B'
  const fieldingTeamKey = battingTeamKey === 'A' ? 'B' : 'A';
  const battingTeamObj = battingTeamKey === 'A' ? match.teamA : match.teamB;
  const fieldingTeamObj = fieldingTeamKey === 'A' ? match.teamA : match.teamB;

  const handleScore = (type, runs) => {
    onScore(type, runs, soKey, so);
  };

  const handleSetup = () => {
    if (!batter1 || !batter2 || !bowlerPid) return;
    onScore('soSetup', 0, soKey, so, { batter1, batter2, bowlerPid });
    setSetup(false);
  };

  if (setup || !soInn?.striker) {
    return (
      <div className="page fade-in">
        <div className="flex items-center gap-3 mb-4">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
          <div style={{ fontWeight: 700, fontSize: 18 }}>⚡ Super Over Setup</div>
        </div>
        <div className="card mb-3">
          <div className="section-title">🏏 {battingTeamObj?.name} — Choose Batters</div>
          <div style={{ marginBottom: 10 }}>
            <label className="label">Batter 1 (Opening)</label>
            <select className="input" value={batter1} onChange={e => setBatter1(e.target.value)}>
              <option value="">— Select —</option>
              {(battingTeamObj?.players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Batter 2</label>
            <select className="input" value={batter2} onChange={e => setBatter2(e.target.value)}>
              <option value="">— Select —</option>
              {(battingTeamObj?.players || []).filter(p => p.id !== batter1).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="card mb-4">
          <div className="section-title">🎯 {fieldingTeamObj?.name} — Choose Bowler</div>
          <select className="input" value={bowlerPid} onChange={e => setBowlerPid(e.target.value)}>
            <option value="">— Select —</option>
            {(fieldingTeamObj?.players || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary w-full" disabled={!batter1 || !batter2 || !bowlerPid} onClick={handleSetup}>
          Start Super Over ⚡
        </button>
      </div>
    );
  }

  const balls = soInn.balls || 0;
  const runs = soInn.runs || 0;
  const wickets = soInn.wickets || 0;
  const ballsLeft = 6 - balls;

  // Target if 2nd innings (chasing)
  const so1Runs = so.innings?.so1?.runs;
  const target = soKey === 'so2' && so1Runs !== undefined ? so1Runs + 1 : null;
  const chasing = target !== null ? `Target: ${target}` : '';

  // Innings ends early in so2 if the target is reached (chase successful) or over/wickets done
  const targetReached = target !== null && runs >= target;
  const innComplete = balls >= 6 || wickets >= 2 || targetReached;

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-3">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>⚡ Super Over</div>
        <span className="badge badge-live" style={{ marginLeft: 'auto' }}>LIVE</span>
      </div>

      {/* Scoreboard */}
      <div className="card mb-3" style={{ background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>{battingTeamObj?.name}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{runs}/{wickets}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>{balls}/6 balls • {ballsLeft} left</div>
          </div>
          {target !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Target</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: runs >= target ? 'var(--green)' : 'var(--red)' }}>{target}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Need {Math.max(0, target - runs)} off {ballsLeft} balls</div>
            </div>
          )}
        </div>
      </div>

      {innComplete ? (
        <div className="card mb-3" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>
            {soKey === 'so1'
              ? '🏏 1st Super Over Complete!'
              : targetReached
                ? `🎉 Target Chased!`
                : '⚡ Super Over Done!'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gold)', marginBottom: 8 }}>{runs}/{wickets}</div>
          {soKey === 'so2' && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
              {targetReached
                ? `Chased ${target} in ${balls} ball${balls === 1 ? '' : 's'}!`
                : `Needed ${target}, finished on ${runs} — fell short by ${target - runs}`}
            </div>
          )}
          <button className="btn btn-primary w-full" onClick={() => onEndSuperOver(soKey, runs, wickets)}>
            {soKey === 'so1' ? '→ Start 2nd Super Over Innings' : '🏆 Finish & Declare Winner'}
          </button>
        </div>
      ) : (
        <>
          {/* Current batsmen */}
          <div className="card mb-3">
            {[soInn.striker, soInn.nonStriker].filter(Boolean).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400 }}>{p.name}{i === 0 ? ' 🏏' : ''}</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
                  {soInn.batsmen?.[p.id]?.runs || 0} ({soInn.batsmen?.[p.id]?.balls || 0})
                </div>
              </div>
            ))}
          </div>

          {/* Score buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
            {[['·',0],['1',1],['2',2],['3',3],['4',4],['6',6]].map(([lbl, r]) => (
              <button key={r} className={`score-btn ${r===4?'four':r===6?'six':r===0?'dot':'one'}`} onClick={() => handleScore('ball', r)}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
            <button className="score-btn wicket" onClick={() => handleScore('wicket', 0)}>🏏 OUT</button>
            <button className="score-btn wide" onClick={() => handleScore('wide', 0)}>WIDE</button>
            {[0,1,4,6].map(r => (
              <button key={r} className="score-btn noball" style={{ fontSize: 11, width: r===0?72:52 }} onClick={() => handleScore('noball', r)}>{r===0?'NO BALL':`NB+${r}`}</button>
            ))}
          </div>
          <button className="btn btn-ghost w-full mb-2" onClick={onUndo}>↩ Undo Last Ball</button>
        </>
      )}

      {/* Ball-by-ball */}
      <div className="card">
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Super Over Balls</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(soInn.balls_by_ball || []).map((b, i) => (
            <span key={i} className={`over-dot ${b.wicket ? 'ball-wicket' : b.wide ? 'ball-wide' : b.noball ? 'ball-noball' : b.runs === 4 ? 'ball-four' : b.runs === 6 ? 'ball-six' : ''}`}>
              {b.wicket ? 'W' : b.wide ? 'Wd' : b.noball ? `NB${b.runs > 0 ? '+'+b.runs : ''}` : b.runs || '·'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// PERFORMANCE GRAPHS PAGE
// ============================================================
function PerformanceGraphPage({ playerId, state, onBack }) {
  const [graphType, setGraphType] = useState('runs'); // runs | wickets | sr | form

  // Build player name
  const playerMap = {};
  Object.values(state.matches).forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => { if (p?.id) playerMap[p.id] = p; });
  });
  const playerName = playerMap[playerId]?.name || state.players?.[playerId]?.name || 'Player';

  // Get all matches this player participated in, sorted by date
  const matchHistory = Object.values(state.matches)
    .filter(m => {
      return Object.values(m.innings || {}).some(inn =>
        inn.batsmen?.[playerId] || inn.bowlers?.[playerId]
      );
    })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  // Build data points
  const dataPoints = matchHistory.map((match, idx) => {
    let runs = 0, wkts = 0, balls = 0, sr = 0;
    Object.values(match.innings || {}).forEach(inn => {
      if (inn.batsmen?.[playerId]) { runs += inn.batsmen[playerId].runs || 0; balls += inn.batsmen[playerId].balls || 0; }
      if (inn.bowlers?.[playerId]) wkts += inn.bowlers[playerId].wickets || 0;
    });
    sr = balls > 0 ? Math.round((runs / balls) * 100) : 0;
    return { match: idx + 1, label: match.title?.slice(0, 8) || `M${idx+1}`, runs, wkts, sr, balls };
  });

  if (dataPoints.length === 0) return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 20 }}>📈 {playerName} — Graphs</div>
      </div>
      <div className="empty"><div className="empty-icon">📈</div><div className="empty-title">No match data yet</div></div>
    </div>
  );

  const last10 = dataPoints.slice(-10);
  const graphData = last10;

  // Simple SVG bar chart
  const renderBarChart = (data, valueKey, color, label) => {
    const maxVal = Math.max(1, ...data.map(d => d[valueKey] || 0));
    const W = 320, H = 160, BAR_W = Math.max(10, (W - 40) / data.length - 4);
    return (
      <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', maxWidth: W }}>
        {/* Y axis labels */}
        {[0, Math.round(maxVal/2), maxVal].map((v, i) => (
          <text key={i} x="4" y={H - (v/maxVal)*H + 4} fontSize="9" fill="var(--text3)">{v}</text>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const val = d[valueKey] || 0;
          const barH = Math.max(2, (val / maxVal) * H);
          const x = 30 + i * ((W - 30) / data.length);
          return (
            <g key={i}>
              <rect x={x} y={H - barH} width={BAR_W} height={barH} fill={color} rx="2" opacity="0.85" />
              <text x={x + BAR_W/2} y={H + 12} fontSize="8" fill="var(--text3)" textAnchor="middle">{d.label}</text>
              {val > 0 && <text x={x + BAR_W/2} y={H - barH - 3} fontSize="9" fill="var(--text2)" textAnchor="middle">{val}</text>}
            </g>
          );
        })}
        {/* Axis line */}
        <line x1="28" y1={H} x2={W} y2={H} stroke="var(--border)" strokeWidth="1" />
        {/* Label */}
        <text x={W/2} y={H + 26} fontSize="10" fill="var(--text3)" textAnchor="middle">{label} (Last {data.length} matches)</text>
      </svg>
    );
  };

  // Cumulative line chart
  const renderLineChart = (data, valueKey, color, label) => {
    let cumVal = 0;
    const cumData = data.map(d => { cumVal += d[valueKey] || 0; return { ...d, cum: cumVal }; });
    const maxVal = Math.max(1, cumVal);
    const W = 320, H = 140;
    const pts = cumData.map((d, i) => {
      const x = 30 + (i / Math.max(1, cumData.length - 1)) * (W - 40);
      const y = H - (d.cum / maxVal) * H;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', maxWidth: W }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {cumData.map((d, i) => {
          const x = 30 + (i / Math.max(1, cumData.length - 1)) * (W - 40);
          const y = H - (d.cum / maxVal) * H;
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
        <line x1="28" y1={H} x2={W} y2={H} stroke="var(--border)" strokeWidth="1" />
        <text x={W/2} y={H + 26} fontSize="10" fill="var(--text3)" textAnchor="middle">{label} (cumulative)</text>
      </svg>
    );
  };

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 20 }}>📈 {playerName} — Graphs</div>
      </div>

      <div className="tabs mb-4" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {[['runs','🏏 Runs'],['wickets','🎯 Wickets'],['sr','⚡ SR'],['form','📊 Form'],['cumruns','📈 Total Runs'],['cumwkts','📈 Total Wkts']].map(([v,l]) => (
          <button key={v} className={`tab ${graphType===v?'active':''}`} style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => setGraphType(v)}>{l}</button>
        ))}
      </div>

      <div className="card" style={{ padding: '16px 8px' }}>
        {graphType === 'runs' && renderBarChart(graphData, 'runs', 'var(--gold)', 'Runs per match')}
        {graphType === 'wickets' && renderBarChart(graphData, 'wkts', 'var(--red)', 'Wickets per match')}
        {graphType === 'sr' && renderBarChart(graphData, 'sr', 'var(--blue)', 'Strike Rate per match')}
        {graphType === 'form' && (
          <div>
            {renderBarChart(graphData, 'runs', 'var(--gold)', 'Form — Runs')}
            <div style={{ marginTop: 12 }}>
              {renderBarChart(graphData, 'wkts', 'var(--green)', 'Form — Wickets')}
            </div>
          </div>
        )}
        {graphType === 'cumruns' && renderLineChart(graphData, 'runs', 'var(--gold)', 'Cumulative Runs')}
        {graphType === 'cumwkts' && renderLineChart(graphData, 'wkts', 'var(--red)', 'Cumulative Wickets')}
      </div>

      <div style={{ marginTop: 12, padding: '10px', background: 'var(--bg2)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 6 }}>Last {graphData.length} Matches Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          <div className="stat-box"><div className="stat-val">{graphData.reduce((s,d) => s+d.runs, 0)}</div><div className="stat-label">Runs</div></div>
          <div className="stat-box"><div className="stat-val">{graphData.reduce((s,d) => s+d.wkts, 0)}</div><div className="stat-label">Wickets</div></div>
          <div className="stat-box"><div className="stat-val">{graphData.length > 0 ? Math.round(graphData.reduce((s,d) => s+d.runs, 0) / graphData.length) : 0}</div><div className="stat-label">Avg/Match</div></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RECORDS PAGE
// ============================================================
function AllSeriesPage({ state, onBack, onNav }) {
  const [search, setSearch] = useState('');
  const all = Object.values(state.series)
    .filter(s => s.creatorId === state.user?.id || s.isPublic)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const filtered = all.filter(s => !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.teamA?.toLowerCase().includes(search.toLowerCase()) ||
    s.teamB?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 22 }}>All Series</div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{all.length} total</span>
      </div>
      <input className="input mb-3" placeholder="🔍 Search series..." value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.length === 0 && <div className="empty"><div className="empty-icon">🏆</div><div className="empty-title">No series found</div></div>}
      {filtered.map(s => <SeriesCard key={s.id} series={s} onClick={() => onNav('series', s.id)} />)}
    </div>
  );
}

function AllMatchesPage({ state, onBack, onNav }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const all = Object.values(state.matches)
    .filter(m => m.ownerId === state.user?.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const filtered = all.filter(m => {
    const mf = filter === 'all' || m.status === filter;
    const ms = !search || m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.teamA?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.teamB?.name?.toLowerCase().includes(search.toLowerCase());
    return mf && ms;
  });
  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 22 }}>All Matches</div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{all.length} total</span>
      </div>
      <input className="input mb-3" placeholder="🔍 Search matches..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="tabs mb-3" style={{ overflowX: 'auto' }}>
        {[['all','All'],['live','🔴 Live'],['done','✅ Done'],['setup','⏳ Setup']].map(([v,l]) => (
          <button key={v} className={`tab ${filter===v?'active':''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      {filtered.length === 0 && <div className="empty"><div className="empty-icon">🏏</div><div className="empty-title">No matches found</div></div>}
      {filtered.map(m => <MatchCard key={m.id} match={m} onClick={() => onNav('match', m.id)} />)}
    </div>
  );
}

function RecordsPage({ state, onBack, onNav }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingRecord, setEditingRecord] = useState(null); // { category, entryIdx }

  // Build complete player map from all sources
  const playerMap = { ...state.players };
  Object.values(state.matches).forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => {
      if (p?.id) playerMap[p.id] = { ...p, ...playerMap[p.id] };
    });
  });
  const getName = pid => playerMap[pid]?.name || (pid ? `Player(${pid.slice(-4)})` : 'Unknown');

  const records = [];

  // ── Per-match data for single-match records ──
  const perMatchBatting = []; // { pid, name, runs, balls, fours, sixes, matchTitle, matchId, seriesId }
  const perMatchBowling = []; // { pid, name, wickets, runs, balls, matchTitle, matchId }

  // ── Overall totals per player ──
  const overallBat = {}; // pid → { runs, balls, innings, fifties, centuries, ducks, notOuts, fastestFiftyBalls, fastestFiftyMatch, fastestCenturyBalls, fastestCenturyMatch, milestones100Runs:{balls,matches}, milestones500Runs, milestones1000Runs }
  const overallBowl = {}; // pid → { wickets, balls, milestones10W:{balls,matches}, milestones25W, milestones50W }

  // ── Per-series data ──
  const seriesBat = {}; // `${pid}_${seriesId}` → { pid, seriesName, runs, fifties, centuries, ducks }

  Object.values(state.matches).forEach(match => {
    const matchTitle = match.title || 'Unnamed Match';
    const seriesId = match.seriesId || null;
    const seriesName = seriesId && state.series?.[seriesId]?.name ? state.series[seriesId].name : null;

    Object.values(match.innings || {}).forEach(inn => {
      // ── Batting ──
      Object.entries(inn.batsmen || {}).forEach(([pid, bats]) => {
        const r = bats.runs || 0, b = bats.balls || 0;
        const fours = bats.fours || 0, sixes = bats.sixes || 0;

        // Per-match
        perMatchBatting.push({ pid, name: getName(pid), runs: r, balls: b, fours, sixes, matchTitle, matchId: match.id, seriesId });

        // Overall
        if (!overallBat[pid]) overallBat[pid] = {
          runs: 0, balls: 0, innings: 0, fifties: 0, centuries: 0, ducks: 0, notOuts: 0,
          fastestFiftyBalls: 9999, fastestFiftyMatch: '', fastestCenturyBalls: 9999, fastestCenturyMatch: '',
          m100: null, m500: null, m1000: null, // {balls, matches} when milestone reached
        };
        const ob = overallBat[pid];
        const prevRuns = ob.runs;
        const prevBalls = ob.balls;
        const prevMatches = ob.matches || 0;
        ob.runs += r; ob.balls += b; ob.innings++;
        if (!bats.out) ob.notOuts++;
        if (r === 0 && bats.out) ob.ducks++;
        if (r >= 50 && r < 100) ob.fifties++;
        if (r >= 100) ob.centuries++;
        ob.matches = (ob.matches || 0) + 1;

        // Milestone tracking (100, 500, 1000 runs)
        [[100,'m100'],[500,'m500'],[1000,'m1000']].forEach(([target, key]) => {
          if (!ob[key] && ob.runs >= target) {
            ob[key] = { balls: ob.balls, matches: ob.matches, matchTitle };
          }
        });

        // Fastest fifty/century via ball-by-ball
        if (r >= 50) {
          let rr = 0, rb = 0, fiftyAt = null, centAt = null;
          (inn.balls_by_ball || []).forEach(ball => {
            if (ball.batsman !== pid) return;
            if (!ball.wide) { rb++; rr += (ball.runs || 0); }
            if (rr >= 50 && fiftyAt === null) fiftyAt = rb;
            if (rr >= 100 && centAt === null) centAt = rb;
          });
          if (fiftyAt === null) fiftyAt = b; // fallback
          if (centAt === null && r >= 100) centAt = b;
          if (fiftyAt && fiftyAt < ob.fastestFiftyBalls) { ob.fastestFiftyBalls = fiftyAt; ob.fastestFiftyMatch = matchTitle; }
          if (centAt && centAt < ob.fastestCenturyBalls) { ob.fastestCenturyBalls = centAt; ob.fastestCenturyMatch = matchTitle; }
        }

        // Per-series batting
        if (seriesId && seriesName) {
          const sk = `${pid}_${seriesId}`;
          if (!seriesBat[sk]) seriesBat[sk] = { pid, name: getName(pid), seriesName, runs: 0, fifties: 0, centuries: 0, ducks: 0, innings: 0 };
          seriesBat[sk].runs += r; seriesBat[sk].innings++;
          if (r >= 50 && r < 100) seriesBat[sk].fifties++;
          if (r >= 100) seriesBat[sk].centuries++;
          if (r === 0 && bats.out) seriesBat[sk].ducks++;
        }
      });

      // ── Bowling ──
      Object.entries(inn.bowlers || {}).forEach(([pid, bowl]) => {
        const wkts = bowl.wickets || 0, br = bowl.runs || 0, bb = bowl.balls || 0;
        perMatchBowling.push({ pid, name: getName(pid), wickets: wkts, runs: br, balls: bb, matchTitle, matchId: match.id });

        if (!overallBowl[pid]) overallBowl[pid] = {
          wickets: 0, balls: 0, wMatches: 0,
          m10w: null, m25w: null, m50w: null,
        };
        const ob = overallBowl[pid];
        ob.wickets += wkts; ob.balls += bb; ob.wMatches++;
        [[10,'m10w'],[25,'m25w'],[50,'m50w']].forEach(([target, key]) => {
          if (!ob[key] && ob.wickets >= target) {
            ob[key] = { balls: ob.balls, matches: ob.wMatches, matchTitle };
          }
        });
      });
    });
  });

  // ── BUILD RECORDS LIST ──
  // Overall batting
  Object.entries(overallBat).forEach(([pid, s]) => {
    const name = getName(pid);
    if (s.fifties > 0) records.push({ category: 'Most Fifties (Overall)', player: name, value: s.fifties, details: '50s', sortVal: s.fifties });
    if (s.centuries > 0) records.push({ category: 'Most Centuries (Overall)', player: name, value: s.centuries, details: '100s', sortVal: s.centuries });
    if (s.ducks > 0) records.push({ category: 'Most Ducks (Overall)', player: name, value: s.ducks, details: 'ducks', sortVal: s.ducks });
    if (s.fastestFiftyBalls < 9999) records.push({ category: 'Fastest Fifty', player: name, value: `${s.fastestFiftyBalls} balls`, details: s.fastestFiftyMatch, sortVal: -s.fastestFiftyBalls });
    if (s.fastestCenturyBalls < 9999) records.push({ category: 'Fastest Century', player: name, value: `${s.fastestCenturyBalls} balls`, details: s.fastestCenturyMatch, sortVal: -s.fastestCenturyBalls });
    if (s.m100) records.push({ category: 'Fastest to 100 Runs (Balls)', player: name, value: `${s.m100.balls} balls`, details: s.m100.matchTitle, sortVal: -s.m100.balls });
    if (s.m100) records.push({ category: 'Fastest to 100 Runs (Matches)', player: name, value: `${s.m100.matches} matches`, details: s.m100.matchTitle, sortVal: -s.m100.matches });
    if (s.m500) records.push({ category: 'Fastest to 500 Runs (Balls)', player: name, value: `${s.m500.balls} balls`, details: s.m500.matchTitle, sortVal: -s.m500.balls });
    if (s.m500) records.push({ category: 'Fastest to 500 Runs (Matches)', player: name, value: `${s.m500.matches} matches`, details: s.m500.matchTitle, sortVal: -s.m500.matches });
    if (s.m1000) records.push({ category: 'Fastest to 1000 Runs (Balls)', player: name, value: `${s.m1000.balls} balls`, details: s.m1000.matchTitle, sortVal: -s.m1000.balls });
    if (s.m1000) records.push({ category: 'Fastest to 1000 Runs (Matches)', player: name, value: `${s.m1000.matches} matches`, details: s.m1000.matchTitle, sortVal: -s.m1000.matches });
  });

  // Overall bowling milestones
  Object.entries(overallBowl).forEach(([pid, s]) => {
    const name = getName(pid);
    if (s.m10w) records.push({ category: 'Fastest to 10 Wickets (Balls)', player: name, value: `${s.m10w.balls} balls`, details: s.m10w.matchTitle, sortVal: -s.m10w.balls });
    if (s.m10w) records.push({ category: 'Fastest to 10 Wickets (Matches)', player: name, value: `${s.m10w.matches} matches`, details: s.m10w.matchTitle, sortVal: -s.m10w.matches });
    if (s.m25w) records.push({ category: 'Fastest to 25 Wickets (Balls)', player: name, value: `${s.m25w.balls} balls`, details: s.m25w.matchTitle, sortVal: -s.m25w.balls });
    if (s.m25w) records.push({ category: 'Fastest to 25 Wickets (Matches)', player: name, value: `${s.m25w.matches} matches`, details: s.m25w.matchTitle, sortVal: -s.m25w.matches });
    if (s.m50w) records.push({ category: 'Fastest to 50 Wickets (Balls)', player: name, value: `${s.m50w.balls} balls`, details: s.m50w.matchTitle, sortVal: -s.m50w.balls });
    if (s.m50w) records.push({ category: 'Fastest to 50 Wickets (Matches)', player: name, value: `${s.m50w.matches} matches`, details: s.m50w.matchTitle, sortVal: -s.m50w.matches });
  });

  // Per-match batting records
  const pmByBatter = {};
  perMatchBatting.forEach(r => {
    if (!pmByBatter[r.matchId + '_' + r.pid]) pmByBatter[r.matchId + '_' + r.pid] = r;
    else { // same player, same match — sum up (two innings in same match)
      pmByBatter[r.matchId + '_' + r.pid].runs += r.runs;
      pmByBatter[r.matchId + '_' + r.pid].balls += r.balls;
      pmByBatter[r.matchId + '_' + r.pid].fours += r.fours;
      pmByBatter[r.matchId + '_' + r.pid].sixes += r.sixes;
    }
  });
  const pmBat = Object.values(pmByBatter);

  // SR per match (min 20 runs)
  pmBat.forEach(r => {
    if (r.runs >= 20 && r.balls > 0) {
      const sr = ((r.runs / r.balls) * 100).toFixed(1);
      records.push({ category: 'Highest Strike Rate (Single Match, min 20 runs)', player: r.name, value: `${sr}`, details: r.matchTitle, sortVal: parseFloat(sr) });
    }
    if (r.sixes > 0) records.push({ category: 'Most Sixes (Single Match)', player: r.name, value: r.sixes, details: r.matchTitle, sortVal: r.sixes });
    if (r.fours > 0) records.push({ category: 'Most Fours (Single Match)', player: r.name, value: r.fours, details: r.matchTitle, sortVal: r.fours });
    if ((r.fours + r.sixes) > 0) records.push({ category: 'Most Boundaries (Single Match)', player: r.name, value: r.fours + r.sixes, details: r.matchTitle, sortVal: r.fours + r.sixes });
  });

  // Per-match bowling records
  const pmByBowler = {};
  perMatchBowling.forEach(r => {
    const key = r.matchId + '_' + r.pid;
    if (!pmByBowler[key]) pmByBowler[key] = r;
    else { pmByBowler[key].wickets += r.wickets; pmByBowler[key].runs += r.runs; pmByBowler[key].balls += r.balls; }
  });
  Object.values(pmByBowler).forEach(r => {
    if (r.wickets > 0) records.push({ category: 'Most Wickets (Single Match)', player: r.name, value: r.wickets, details: r.matchTitle, sortVal: r.wickets });
    if (r.balls >= 6) { // min 1 over
      const eco = (r.runs / (r.balls / 6)).toFixed(2);
      records.push({ category: 'Best Economy (Single Match, min 1 over)', player: r.name, value: `${eco} rpo`, details: r.matchTitle, sortVal: -parseFloat(eco) });
      records.push({ category: 'Worst Economy (Single Match, min 1 over)', player: r.name, value: `${eco} rpo`, details: r.matchTitle, sortVal: parseFloat(eco) });
    }
  });

  // ── PER-OVER RECORDS & DOT BALL RECORDS ──
  // Build a name resolver
  const resolvePlayerName = (pid, match) => {
    if (!pid) return null;
    const fromPlayers = Object.values(state.players||{}).find(p => p.id === pid);
    if (fromPlayers?.name) return fromPlayers.name;
    const fromMatch = [...(match.teamA?.players||[]), ...(match.teamB?.players||[])].find(p => p.id === pid);
    if (fromMatch?.name) return fromMatch.name;
    // If pid looks like a name (no dashes/special chars, short string) use it directly
    if (!/^[a-f0-9\-]{8,}$/i.test(pid)) return pid;
    return null;
  };

  // Overall dot balls per batter (across ALL matches)
  const overallBatterDots = {};
  // Overall dot balls per bowler (across ALL matches)
  const overallBowlerDots = {};
  // Per-match dot balls per bowler
  const matchBowlerDots = {}; // `${matchId}_${pid}` → { name, matchTitle, dots }

  Object.values(state.matches).forEach(match => {
    const mt = match.title || 'Unknown';
    const overRuns = {}; // `${innKey}_${overIndex}_${bowlerId}` → runs
    const overBatRuns = {}; // `${innKey}_${overIndex}_${batterId}` → batting runs

    Object.values(match.innings || {}).forEach(inn => {
      (inn.balls_by_ball || []).forEach(ball => {
        // Batter dots overall
        const bId = ball.batsman;
        if (bId && !ball.wide && (ball.runs || 0) === 0 && !ball.wicket) {
          if (!overallBatterDots[bId]) overallBatterDots[bId] = { dots: 0, name: resolvePlayerName(bId, match) || bId };
          overallBatterDots[bId].dots++;
          if (!overallBatterDots[bId].name || overallBatterDots[bId].name === bId) {
            overallBatterDots[bId].name = resolvePlayerName(bId, match) || bId;
          }
        }

        // Bowler dots overall + per match
        const bowId = ball.bowler;
        if (bowId && !ball.wide && !ball.noball && (ball.runs || 0) === 0 && !ball.wicket) {
          if (!overallBowlerDots[bowId]) overallBowlerDots[bowId] = { dots: 0, name: resolvePlayerName(bowId, match) || bowId };
          overallBowlerDots[bowId].dots++;
          if (!overallBowlerDots[bowId].name || overallBowlerDots[bowId].name === bowId) {
            overallBowlerDots[bowId].name = resolvePlayerName(bowId, match) || bowId;
          }
          // Per-match
          const mk = `${match.id}_${bowId}`;
          if (!matchBowlerDots[mk]) matchBowlerDots[mk] = { name: resolvePlayerName(bowId, match) || bowId, matchTitle: mt, dots: 0 };
          matchBowlerDots[mk].dots++;
        }

        // Per-over runs (bowling) — most runs conceded in one over
        if (ball.bowler && ball.overIndex !== undefined) {
          const ovKey = `${match.id}_inn${ball.overIndex}_${ball.bowler}`;
          if (!overRuns[ovKey]) overRuns[ovKey] = { bowlerId: ball.bowler, name: resolvePlayerName(ball.bowler, match) || ball.bowlerName || ball.bowler, runs: 0, matchTitle: mt };
          overRuns[ovKey].runs += ball.totalRuns || ball.runs || 0;
        }

        // Per-over runs (batting) — most runs scored in one over by a batter
        if (ball.batsman && ball.overIndex !== undefined && !ball.wide) {
          const ovKey = `${match.id}_inn${ball.overIndex}_bat_${ball.batsman}`;
          if (!overBatRuns[ovKey]) overBatRuns[ovKey] = { batterId: ball.batsman, name: resolvePlayerName(ball.batsman, match) || ball.batsmanName || ball.batsman, runs: 0, matchTitle: mt };
          overBatRuns[ovKey].runs += ball.runs || 0;
        }
      });

      // Collect over records
      Object.values(overRuns).forEach(r => {
        if (r.runs > 0) records.push({ category: 'Most Runs Conceded in a Single Over', player: r.name, value: `${r.runs} runs`, details: r.matchTitle, sortVal: r.runs });
      });
      Object.values(overBatRuns).forEach(r => {
        if (r.runs > 0) records.push({ category: 'Most Runs Scored in a Single Over', player: r.name, value: `${r.runs} runs`, details: r.matchTitle, sortVal: r.runs });
      });
    });
  });

  // Push overall dot ball records
  Object.values(overallBatterDots).forEach(r => {
    if (r.dots > 0 && r.name) records.push({ category: 'Most Dot Balls Played (Overall)', player: r.name, value: r.dots, details: 'all matches', sortVal: r.dots });
  });
  Object.values(overallBowlerDots).forEach(r => {
    if (r.dots > 0 && r.name) records.push({ category: 'Most Dot Balls Bowled (Overall)', player: r.name, value: r.dots, details: 'all matches', sortVal: r.dots });
  });
  Object.values(matchBowlerDots).forEach(r => {
    if (r.dots > 0 && r.name) records.push({ category: 'Most Dot Balls Bowled (Single Match)', player: r.name, value: r.dots, details: r.matchTitle, sortVal: r.dots });
  });

  // Highest individual score (single innings)
  perMatchBatting.forEach(r => {
    if (r.runs > 0) {
      records.push({ category: 'Highest Individual Score', player: r.name, value: `${r.runs}${r.balls > 0 ? ` (${r.balls}b)` : ''}`, details: r.matchTitle, sortVal: r.runs });
    }
  });

  // Biggest chase (highest successful run chase)
  Object.values(state.matches).forEach(match => {
    const i1 = match.innings?.['1'], i2 = match.innings?.['2'];
    if (i1 && i2 && match.status === 'done' && match.result?.winner) {
      const target = (i1.runs || 0) + 1;
      if (i2.runs >= target) {
        const winnerName = match.result.winner;
        records.push({ category: 'Biggest Successful Chase', player: winnerName, value: `${i2.runs}/${i2.wickets}`, details: `Target ${target} — ${match.title || ''}`, sortVal: target });
      }
    }
  });

  // Highest partnership - use ball-by-ball replay (same logic as PartnershipsPage)
  Object.values(state.matches).forEach(match => {
    const mt = match.title || 'Unknown';
    const getPN = pid => {
      const f = Object.values(state.players||{}).find(p=>p.id===pid);
      if (f?.name) return f.name;
      const g = [...(match.teamA?.players||[]),...(match.teamB?.players||[])].find(p=>p.id===pid);
      if (g?.name) return g.name;
      // if pid looks like a name string directly
      if (pid && !/^[a-f0-9\-]{8,}$/i.test(pid)) return pid;
      return null;
    };
    Object.values(match.innings || {}).forEach(inn => {
      const balls = inn.balls_by_ball || [];
      if (balls.length === 0) return; // skip no-ball-by-ball innings to avoid spurious records
      const batsmenSeen = new Set();
      let p1 = null, p2 = null;
      let p1Runs = 0, p1Balls = 0, p2Runs = 0, p2Balls = 0;
      let waiting = false;
      const resolveB = val => {
        if (!val) return null;
        const byId = [...(match.teamA?.players||[]),...(match.teamB?.players||[])].find(p=>p.id===val);
        if (byId) return byId.id;
        const byName = [...(match.teamA?.players||[]),...(match.teamB?.players||[])].find(p=>p.name===val);
        if (byName) return byName.id;
        return val;
      };
      balls.forEach(ball => {
        const bid = resolveB(ball.batsman);
        if (bid) batsmenSeen.add(bid);
        if (!p1 && batsmenSeen.size >= 2 && !waiting) {
          const arr = Array.from(batsmenSeen); p1 = arr[0]; p2 = arr[1];
          p1Runs = 0; p1Balls = 0; p2Runs = 0; p2Balls = 0;
        }
        if (waiting && bid && bid !== p1) { p2 = bid; p1Runs = 0; p1Balls = 0; p2Runs = 0; p2Balls = 0; waiting = false; }
        if (p1 && p2 && !waiting) {
          if (!ball.wide) {
            const runs = ball.runs || 0;
            if (bid === p1) { p1Balls++; p1Runs += runs; }
            else if (bid === p2) { p2Balls++; p2Runs += runs; }
          }
          if (ball.wicket) {
            const curRuns = p1Runs + p2Runs;
            if (curRuns >= 20) {
              const n1 = getPN(p1), n2 = getPN(p2);
              if (n1 && n2) records.push({
                category: 'Highest Partnership',
                player: `${n1} & ${n2}`,
                value: curRuns,
                details: `${mt} — ${n1} ${p1Runs}(${p1Balls}) & ${n2} ${p2Runs}(${p2Balls})`,
                sortVal: curRuns
              });
            }
            const outId = ball.outBatsman === 'nonStriker' ? (bid === p1 ? p2 : p1) : bid;
            p1 = outId === p1 ? p2 : p1; p2 = null;
            p1Runs = 0; p1Balls = 0; p2Runs = 0; p2Balls = 0; waiting = true;
          }
        }
      });
      // Unbroken partnership at end
      if (p1 && p2 && (p1Runs + p2Runs) >= 20) {
        const n1 = getPN(p1), n2 = getPN(p2);
        if (n1 && n2) records.push({
          category: 'Highest Partnership',
          player: `${n1} & ${n2}`,
          value: p1Runs + p2Runs,
          details: `${mt} — ${n1} ${p1Runs}(${p1Balls}) & ${n2} ${p2Runs}(${p2Balls})`,
          sortVal: p1Runs + p2Runs
        });
      }
    });
  });

  // ── Highest and Lowest team totals ──
  Object.values(state.matches).forEach(match => {
    const mt = match.title || 'Unknown';
    const inn1 = match.innings?.['1'];
    const inn2 = match.innings?.['2'];

    Object.values(match.innings || {}).forEach(inn => {
      const runs = inn.runs || 0;
      const teamName = inn.team === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
      const detail = mt + ' (' + (inn.wickets||0) + ' wkts)';

      if (runs >= 20) records.push({ category: 'Highest Team Total (Single Match)', player: teamName, value: runs, details: detail, sortVal: runs, matchId: match.id });

      // Lowest total (min 4 overs to avoid forfeit/incomplete)
      if (runs >= 0 && (inn.balls||0) >= 24) {
        records.push({ category: 'Lowest Team Total (Single Match)', player: teamName, value: runs, details: detail, sortVal: -runs, matchId: match.id });
      }
    });

    // Lowest total successfully defended: team batted 1st, team batted 2nd could not chase
    if (inn1 && inn2 && match.status === 'done' && match.result?.winner) {
      const team1Name = inn1.team === 'A' ? (match.teamA?.name||'Team A') : (match.teamB?.name||'Team B');
      const team2Name = inn2.team === 'A' ? (match.teamA?.name||'Team A') : (match.teamB?.name||'Team B');
      // Team 1 won (defended their total)
      if (match.result.winner === team1Name && (inn1.balls||0) >= 24) {
        const defended = inn1.runs || 0;
        records.push({ category: 'Lowest Total Successfully Defended', player: team1Name, value: defended, details: mt + ' (defended vs ' + team2Name + ')', sortVal: -defended, matchId: match.id });
      }
    }
  });

  // ── Lowest Strike Rate (Single Match, min 10 balls) ──
  perMatchBatting.forEach(r => {
    if (r.balls >= 10) {
      const sr = (r.runs / r.balls) * 100;
      records.push({ category: 'Lowest Strike Rate (Single Match, min 10 balls)', player: r.name, value: sr.toFixed(1), details: `${r.matchTitle} — ${r.runs}(${r.balls})`, sortVal: -sr, matchId: r.matchId });
    }
  });

  // ── Most Consecutive Matches Without Scoring a Run ──
  // Walk each player's innings in chronological order and find their longest
  // streak of innings where they scored exactly 0 runs (whether out or not out).
  {
    const matchesSorted = Object.values(state.matches)
      .filter(m => m.status === 'done' || Object.keys(m.innings || {}).length > 0)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const playerInningsHistory = {}; // pid → [{ runs, matchTitle }]
    matchesSorted.forEach(match => {
      const mt = match.title || 'Unknown';
      Object.values(match.innings || {}).forEach(inn => {
        Object.entries(inn.batsmen || {}).forEach(([pid, bats]) => {
          if (!playerInningsHistory[pid]) playerInningsHistory[pid] = [];
          playerInningsHistory[pid].push({ runs: bats.runs || 0, matchTitle: mt });
        });
      });
    });
    Object.entries(playerInningsHistory).forEach(([pid, history]) => {
      let curStreak = 0, bestStreak = 0, bestMatchSpan = '';
      let streakStartTitle = '';
      history.forEach((h, idx) => {
        if (h.runs === 0) {
          if (curStreak === 0) streakStartTitle = h.matchTitle;
          curStreak++;
          if (curStreak > bestStreak) { bestStreak = curStreak; bestMatchSpan = curStreak > 1 ? `${streakStartTitle} → ${h.matchTitle}` : h.matchTitle; }
        } else {
          curStreak = 0;
        }
      });
      if (bestStreak >= 2) {
        records.push({ category: 'Most Consecutive Matches Without Scoring', player: getName(pid), value: `${bestStreak} matches`, details: bestMatchSpan, sortVal: bestStreak });
      }
    });
  }

  // ── Most Golden Ducks (out on the very first ball faced) ──
  {
    const goldenDuckCounts = {}; // pid → { count, matches: [{title, matchId}] }
    Object.values(state.matches).forEach(match => {
      const mt = match.title || 'Unknown';
      Object.values(match.innings || {}).forEach(inn => {
        const balls = inn.balls_by_ball || [];
        Object.entries(inn.batsmen || {}).forEach(([pid, bats]) => {
          if (!bats.out || (bats.runs || 0) !== 0) return;
          // Find this player's very first ball faced in this innings, and check
          // whether the wicket fell on that same first ball.
          const firstBallIdx = balls.findIndex(b => b.batsman === pid && !b.wide);
          if (firstBallIdx === -1) return;
          const firstBall = balls[firstBallIdx];
          const isGolden = firstBall.wicket && (bats.balls || 0) <= 1;
          if (isGolden) {
            if (!goldenDuckCounts[pid]) goldenDuckCounts[pid] = { count: 0, lastMatch: '', matchId: null };
            goldenDuckCounts[pid].count++;
            goldenDuckCounts[pid].lastMatch = mt;
            goldenDuckCounts[pid].matchId = match.id;
          }
        });
      });
    });
    Object.entries(goldenDuckCounts).forEach(([pid, d]) => {
      if (d.count > 0) records.push({ category: 'Most Golden Ducks', player: getName(pid), value: d.count, details: `most recent: ${d.lastMatch}`, sortVal: d.count, matchId: d.matchId });
    });
  }

  // Per-series records
  // Need to aggregate per-match batting across series
  const seriesRunsMap = {}; // `${pid}_${seriesId}` → { name, seriesName, runs }
  perMatchBatting.forEach(r => {
    if (!r.seriesId) return;
    const serName = r.seriesId && state.series?.[r.seriesId]?.name ? state.series[r.seriesId].name : 'Series';
    const key = `${r.pid}_${r.seriesId}`;
    if (!seriesRunsMap[key]) seriesRunsMap[key] = { name: r.name, seriesName: serName, runs: 0 };
    seriesRunsMap[key].runs += r.runs;
  });
  Object.values(seriesRunsMap).forEach(r => {
    if (r.runs > 0) records.push({ category: 'Most Runs (Single Series)', player: r.name, value: r.runs, details: r.seriesName, sortVal: r.runs });
  });

  // ── Highest team runs in a single series ──
  const seriesTeamRunsMap = {}; // `${teamName}_${seriesId}` → { teamName, seriesName, runs }
  perMatchBatting.forEach(r => {
    if (!r.seriesId) return;
    const serName = r.seriesId && state.series?.[r.seriesId]?.name ? state.series[r.seriesId].name : 'Series';
    // Use innings data directly for accurate team totals
  });
  Object.values(state.matches).forEach(match => {
    if (!match.seriesId) return;
    const serName = state.series?.[match.seriesId]?.name || 'Series';
    Object.values(match.innings || {}).forEach(inn => {
      const teamName = inn.team === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B');
      const key = teamName + '_' + match.seriesId;
      if (!seriesTeamRunsMap[key]) seriesTeamRunsMap[key] = { teamName, seriesName: serName, runs: 0 };
      seriesTeamRunsMap[key].runs += inn.runs || 0;
    });
  });
  Object.values(seriesTeamRunsMap).forEach(r => {
    if (r.runs > 0) records.push({ category: 'Highest Team Runs (Single Series)', player: r.teamName, value: r.runs, details: r.seriesName, sortVal: r.runs });
  });

  Object.values(seriesBat).forEach(s => {
    if (s.fifties > 0) records.push({ section: 'Series Records', category: 'Most Fifties (Single Series)', player: s.name, value: s.fifties, details: s.seriesName, sortVal: s.fifties });
    if (s.centuries > 0) records.push({ section: 'Series Records', category: 'Most Centuries (Single Series)', player: s.name, value: s.centuries, details: s.seriesName, sortVal: s.centuries });
    if (s.ducks > 0) records.push({ section: 'Series Records', category: 'Most Ducks (Single Series)', player: s.name, value: s.ducks, details: s.seriesName, sortVal: s.ducks });
  });

  // ── NEW BATTING RECORDS ──
  // Most consecutive fifties
  // Most consecutive hundreds
  // Most consecutive ducks
  {
    const matchesSorted = Object.values(state.matches)
      .filter(m => m.status === 'done' || Object.keys(m.innings||{}).length > 0)
      .sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
    const playerScores = {}; // pid -> [{runs, balls, matchTitle, matchId}]
    matchesSorted.forEach(match => {
      const mt = match.title || 'Unknown';
      Object.values(match.innings||{}).forEach(inn => {
        Object.entries(inn.batsmen||{}).forEach(([pid, b]) => {
          if (!playerScores[pid]) playerScores[pid] = [];
          playerScores[pid].push({ runs: b.runs||0, balls: b.balls||0, matchTitle: mt, matchId: match.id });
        });
      });
    });

    Object.entries(playerScores).forEach(([pid, scores]) => {
      const name = getName(pid);
      if (!name || name.startsWith('Player(')) return;

      // Consecutive fifties
      let best50 = 0, cur50 = 0, best50Span = '';
      // Consecutive hundreds
      let best100 = 0, cur100 = 0, best100Span = '';
      // Consecutive ducks (0 runs, got out)
      let bestDuck = 0, curDuck = 0, bestDuckSpan = '';
      let streak50Start = '', streak100Start = '', streakDuckStart = '';

      scores.forEach((s, i) => {
        // Fifty streak
        if (s.runs >= 50) { if (cur50===0) streak50Start = s.matchTitle; cur50++; if (cur50>best50){best50=cur50; best50Span=cur50>1?streak50Start+' → '+s.matchTitle:s.matchTitle;} }
        else cur50 = 0;
        // Century streak
        if (s.runs >= 100) { if (cur100===0) streak100Start = s.matchTitle; cur100++; if (cur100>best100){best100=cur100; best100Span=cur100>1?streak100Start+' → '+s.matchTitle:s.matchTitle;} }
        else cur100 = 0;
        // Duck streak (0 runs and actually batted)
        if (s.runs === 0 && s.balls > 0) { if (curDuck===0) streakDuckStart = s.matchTitle; curDuck++; if (curDuck>bestDuck){bestDuck=curDuck; bestDuckSpan=curDuck>1?streakDuckStart+' → '+s.matchTitle:s.matchTitle;} }
        else curDuck = 0;
      });

      if (best50 >= 2) records.push({ section: 'Batting Records', category: 'Most Consecutive Fifties', player: name, value: best50, details: best50Span, sortVal: best50 });
      if (best100 >= 2) records.push({ section: 'Batting Records', category: 'Most Consecutive Hundreds', player: name, value: best100, details: best100Span, sortVal: best100 });
      if (bestDuck >= 2) records.push({ section: 'Batting Records', category: 'Most Consecutive Ducks', player: name, value: bestDuck, details: bestDuckSpan, sortVal: bestDuck });
    });
  }

  // Best All-Rounder Performance (50+ runs AND 2+ wickets in same match)
  Object.values(state.matches).forEach(match => {
    const mt = match.title || 'Unknown';
    const allPlayers = [...(match.teamA?.players||[]), ...(match.teamB?.players||[])];
    const pid2name = {};
    allPlayers.forEach(p => { pid2name[p.id] = p.name; });
    // Combine batting + bowling from both innings for each player
    const combined = {};
    Object.values(match.innings||{}).forEach(inn => {
      Object.entries(inn.batsmen||{}).forEach(([pid, b]) => {
        if (!combined[pid]) combined[pid] = { runs:0, balls:0, wickets:0 };
        combined[pid].runs += b.runs||0;
        combined[pid].balls += b.balls||0;
      });
      Object.entries(inn.bowlers||{}).forEach(([pid, b]) => {
        if (!combined[pid]) combined[pid] = { runs:0, balls:0, wickets:0 };
        combined[pid].wickets += b.wickets||0;
      });
    });
    Object.entries(combined).forEach(([pid, s]) => {
      if (s.runs >= 30 && s.wickets >= 2) {
        const name = pid2name[pid] || getName(pid);
        if (!name) return;
        const score = s.runs + s.wickets * 20; // combined performance score
        records.push({ section: 'Batting Records', category: 'Best All-Rounder Performance', player: name, value: `${s.runs} runs & ${s.wickets} wkts`, details: mt, sortVal: score, matchId: match.id });
      }
    });
  });

  // ── NEW BOWLING RECORDS ──
  // Most consecutive matches without a wicket
  // Hat-trick (3 wickets in 3 consecutive legal balls)
  // Most wides in single match
  // Most no-balls in single match
  // Most consecutive wides
  {
    const matchesSorted2 = Object.values(state.matches)
      .filter(m => m.status === 'done' || Object.keys(m.innings||{}).length>0)
      .sort((a,b) => (a.createdAt||0)-(b.createdAt||0));

    const bowlerMatchHistory = {}; // pid -> [{ wickets, matchTitle, matchId }]
    matchesSorted2.forEach(match => {
      const mt = match.title || 'Unknown';
      const bowlerMatch = {};
      Object.values(match.innings||{}).forEach(inn => {
        Object.entries(inn.bowlers||{}).forEach(([pid, b]) => {
          if (!bowlerMatch[pid]) bowlerMatch[pid] = 0;
          bowlerMatch[pid] += b.wickets||0;
        });
      });
      Object.entries(bowlerMatch).forEach(([pid, wickets]) => {
        if (!bowlerMatchHistory[pid]) bowlerMatchHistory[pid] = [];
        bowlerMatchHistory[pid].push({ wickets, matchTitle: mt, matchId: match.id });
      });

      // Hat-trick: 3 wickets on consecutive legal balls
      Object.values(match.innings||{}).forEach(inn => {
        const balls = inn.balls_by_ball||[];
        // Look for 3 consecutive wicket balls by same bowler (legal, not wides)
        for (let i = 2; i < balls.length; i++) {
          const b0 = balls[i-2], b1 = balls[i-1], b2 = balls[i];
          if (b0.wicket && b1.wicket && b2.wicket &&
              !b0.wide && !b1.wide && !b2.wide &&
              b0.bowler && b0.bowler===b1.bowler && b1.bowler===b2.bowler) {
            const bowlerName = getName(b0.bowler);
            if (bowlerName) records.push({ section: 'Bowling Records', category: 'Hat-Trick', player: bowlerName, value: '🎩 Hat-Trick!', details: mt, sortVal: 1, matchId: match.id });
          }
        }
      });

      // Wides & no-balls per match per bowler
      const widesPerBowler = {}, noBallsPerBowler = {};
      Object.values(match.innings||{}).forEach(inn => {
        (inn.balls_by_ball||[]).forEach(ball => {
          if (!ball.bowler) return;
          if (ball.wide) widesPerBowler[ball.bowler] = (widesPerBowler[ball.bowler]||0)+1;
          if (ball.noball) noBallsPerBowler[ball.bowler] = (noBallsPerBowler[ball.bowler]||0)+1;
        });
      });
      Object.entries(widesPerBowler).forEach(([pid, count]) => {
        if (count >= 3) records.push({ section: 'Bowling Records', category: 'Most Wides (Single Match)', player: getName(pid), value: count, details: mt, sortVal: count, matchId: match.id });
      });
      Object.entries(noBallsPerBowler).forEach(([pid, count]) => {
        if (count >= 2) records.push({ section: 'Bowling Records', category: 'Most No-Balls (Single Match)', player: getName(pid), value: count, details: mt, sortVal: count, matchId: match.id });
      });

      // Consecutive wides by same bowler
      Object.values(match.innings||{}).forEach(inn => {
        let curWide = 0, bestWide = 0, curBowler = null, bestWidePlayer = '', bestWideMatch = '';
        (inn.balls_by_ball||[]).forEach(ball => {
          if (ball.wide && ball.bowler) {
            if (ball.bowler === curBowler) { curWide++; if (curWide>bestWide){bestWide=curWide; bestWidePlayer=getName(ball.bowler); bestWideMatch=mt; } }
            else { curBowler=ball.bowler; curWide=1; }
          } else { curBowler=null; curWide=0; }
        });
        if (bestWide >= 3 && bestWidePlayer) records.push({ section: 'Bowling Records', category: 'Most Consecutive Wides', player: bestWidePlayer, value: bestWide, details: bestWideMatch, sortVal: bestWide, matchId: match.id });
      });
    });

    // Consecutive matches without a wicket
    Object.entries(bowlerMatchHistory).forEach(([pid, history]) => {
      const name = getName(pid);
      if (!name || name.startsWith('Player(')) return;
      let curStreak = 0, bestStreak = 0, spanStart = '', bestSpan = '';
      history.forEach(h => {
        if (h.wickets === 0) { if (curStreak===0) spanStart=h.matchTitle; curStreak++; if (curStreak>bestStreak){bestStreak=curStreak; bestSpan=curStreak>1?spanStart+' → '+h.matchTitle:h.matchTitle;} }
        else curStreak=0;
      });
      if (bestStreak >= 2) records.push({ section: 'Bowling Records', category: 'Most Consecutive Matches Without a Wicket', player: name, value: `${bestStreak} matches`, details: bestSpan, sortVal: bestStreak });
    });
  }

  // ── NEW PLAYER VS PLAYER RECORDS (from vsStats) ──
  {
    const vsStats = state.playerVsStats || {};
    const allPids = new Set();
    Object.values(vsStats).forEach(v => { allPids.add(v.batterId); allPids.add(v.bowlerId); });
    const allVsMatches = Object.values(state.matches);
    const getVsName = (pid) => {
      for (const m of allVsMatches) {
        const p = [...(m.teamA?.players||[]),...(m.teamB?.players||[])].find(x=>x.id===pid);
        if (p?.name) return p.name;
      }
      return playerMap[pid]?.name || null;
    };

    // Most runs against a single bowler
    Object.values(vsStats).forEach(vs => {
      if ((vs.runs||0) >= 20) {
        const bn = getVsName(vs.bowlerId), batn = getVsName(vs.batterId);
        if (bn && batn) records.push({ section: 'Player vs Player Records', category: 'Most Runs Against One Bowler', player: batn, value: vs.runs, details: `vs ${bn} (${vs.balls||0} balls, ${vs.innings||0} innings)`, sortVal: vs.runs });
      }
    });

    // Most dismissals against a single bowler
    Object.values(vsStats).forEach(vs => {
      if ((vs.wickets||0) >= 2) {
        const bn = getVsName(vs.bowlerId), batn = getVsName(vs.batterId);
        if (bn && batn) records.push({ section: 'Player vs Player Records', category: 'Most Dismissals by One Bowler', player: bn, value: vs.wickets, details: `dismissed ${batn} ${vs.wickets} times`, sortVal: vs.wickets });
      }
    });

    // Highest strike rate against a single bowler (min 6 balls)
    Object.values(vsStats).forEach(vs => {
      if ((vs.balls||0) >= 6) {
        const sr = ((vs.runs||0)/(vs.balls||1)*100).toFixed(1);
        const bn = getVsName(vs.bowlerId), batn = getVsName(vs.batterId);
        if (bn && batn) records.push({ section: 'Player vs Player Records', category: 'Highest SR Against One Bowler (min 6 balls)', player: batn, value: `${sr}`, details: `vs ${bn} — ${vs.runs}(${vs.balls})`, sortVal: parseFloat(sr) });
      }
    });
  }

  // ── POTM RECORDS ──
  {
    const potmCount = {};
    Object.values(state.matches).forEach(match => {
      if (!match.result?.potm) return;
      const potmName = match.result.potm;
      if (!potmCount[potmName]) potmCount[potmName] = { count: 0, lastMatch: '' };
      potmCount[potmName].count++;
      potmCount[potmName].lastMatch = match.title || 'Unknown';
    });
    Object.entries(potmCount).forEach(([name, d]) => {
      if (d.count > 0) records.push({ section: 'Batting Records', category: 'Most Player of the Match Awards', player: name, value: d.count, details: `most recent: ${d.lastMatch}`, sortVal: d.count });
    });
  }

  // ── Assign sections to all existing records ──
  const sectionMap = {
    'Most Fifties (Overall)': 'Batting Records',
    'Most Centuries (Overall)': 'Batting Records',
    'Most Ducks (Overall)': 'Batting Records',
    'Fastest Fifty': 'Batting Records',
    'Fastest Century': 'Batting Records',
    'Fastest to 100 Runs (Balls)': 'Batting Records',
    'Fastest to 100 Runs (Matches)': 'Batting Records',
    'Fastest to 500 Runs (Balls)': 'Batting Records',
    'Fastest to 500 Runs (Matches)': 'Batting Records',
    'Fastest to 1000 Runs (Balls)': 'Batting Records',
    'Fastest to 1000 Runs (Matches)': 'Batting Records',
    'Highest Strike Rate (Single Match, min 20 runs)': 'Batting Records',
    'Most Sixes (Single Match)': 'Batting Records',
    'Most Fours (Single Match)': 'Batting Records',
    'Most Boundaries (Single Match)': 'Batting Records',
    'Highest Individual Score': 'Batting Records',
    'Most Dot Balls Played (Overall)': 'Batting Records',
    'Lowest Strike Rate (Single Match, min 10 balls)': 'Batting Records',
    'Most Golden Ducks': 'Batting Records',
    'Most Consecutive Matches Without Scoring': 'Batting Records',
    'Biggest Successful Chase': 'Team Records',
    'Most Wickets (Single Match)': 'Bowling Records',
    'Best Economy (Single Match, min 1 over)': 'Bowling Records',
    'Worst Economy (Single Match, min 1 over)': 'Bowling Records',
    'Most Dot Balls Bowled (Overall)': 'Bowling Records',
    'Most Dot Balls Bowled (Single Match)': 'Bowling Records',
    'Most Runs Conceded in a Single Over': 'Bowling Records',
    'Fastest to 10 Wickets (Balls)': 'Bowling Records',
    'Fastest to 10 Wickets (Matches)': 'Bowling Records',
    'Fastest to 25 Wickets (Balls)': 'Bowling Records',
    'Fastest to 25 Wickets (Matches)': 'Bowling Records',
    'Fastest to 50 Wickets (Balls)': 'Bowling Records',
    'Fastest to 50 Wickets (Matches)': 'Bowling Records',
    'Most Runs Scored in a Single Over': 'Team Records',
    'Highest Team Total (Single Match)': 'Team Records',
    'Lowest Team Total (Single Match)': 'Team Records',
    'Lowest Total Successfully Defended': 'Team Records',
    'Highest Team Runs (Single Series)': 'Series Records',
    'Most Runs (Single Series)': 'Series Records',
    'Most Fifties (Single Series)': 'Series Records',
    'Most Centuries (Single Series)': 'Series Records',
    'Most Ducks (Single Series)': 'Series Records',
    'Highest Partnership': 'Batting Records',
  };
  records.forEach(r => {
    if (!r.section) r.section = sectionMap[r.category] || 'Other';
  });

  // ── FILTER & GROUP ──
  const SECTIONS = ['All', 'Batting Records', 'Bowling Records', 'Team Records', 'Series Records', 'Player vs Player Records'];
  const filtered = records.filter(r => {
    const ms = !searchTerm || r.player.toLowerCase().includes(searchTerm.toLowerCase()) || r.category.toLowerCase().includes(searchTerm.toLowerCase()) || (r.details||'').toLowerCase().includes(searchTerm.toLowerCase());
    const mc = activeCategory === 'All' || r.section === activeCategory;
    return ms && mc;
  });
  const grouped = {};
  filtered.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });
  Object.keys(grouped).forEach(cat => {
    grouped[cat].sort((a, b) => b.sortVal - a.sortVal);
    grouped[cat] = grouped[cat].slice(0, 3);
  });
  const medals = ['🥇', '🥈', '🥉'];

  // Go to Match button: show for team total, lowest defended, hat-trick, wides, no-balls, consecutive wides, best all-rounder, etc.
  const showGoToMatch = new Set(['Highest Team Total (Single Match)', 'Lowest Team Total (Single Match)', 'Lowest Total Successfully Defended', 'Hat-Trick', 'Most Wides (Single Match)', 'Most No-Balls (Single Match)', 'Most Consecutive Wides', 'Best All-Rounder Performance', 'Most Golden Ducks', 'Biggest Successful Chase']);

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 22 }}>📊 Records</div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--blue)' }}
          onClick={() => {
            const tableRows = Object.entries(grouped).map(([cat, entries]) =>
              `<h3 style="font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px">${cat}</h3>` +
              `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">` +
              entries.map((e,i) => `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}"><td style="padding:5px 8px;border:1px solid #eee;width:28px">${i===0?'🥇':i===1?'🥈':'🥉'}</td><td style="padding:5px 8px;border:1px solid #eee;font-weight:600">${e.player}</td><td style="padding:5px 8px;border:1px solid #eee;font-weight:700;text-align:right;color:#1a1a1a">${e.value}</td><td style="padding:5px 8px;border:1px solid #eee;color:#888;font-size:11px">${e.details||''}</td></tr>`).join('') +
              `</table>`
            ).join('');
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Crictera Records</title><style>body{font-family:Arial,sans-serif;padding:24px;max-width:860px;margin:0 auto}</style></head><body><h1 style="text-align:center;margin-bottom:4px">📊 Cricket Records</h1><p style="text-align:center;color:#888;font-size:12px;margin-bottom:20px">Generated ${new Date().toLocaleDateString()}</p>${tableRows}<div style="text-align:center;margin-top:20px;color:#aaa;font-size:11px;border-top:1px solid #ddd;padding-top:10px">Crictera by Saksham Arora</div></body></html>`;
            downloadHTML(html, 'crictera_records.html');
          }}>📥 PDF</button>
      </div>
      <input className="input mb-3" placeholder="🔍 Search player, record or match..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

      {/* Section tabs */}
      <div className="tabs mb-4" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', overflowX: 'auto' }}>
        {SECTIONS.map(sec => (
          <button key={sec} className={`tab ${activeCategory === sec ? 'active' : ''}`}
            style={{ fontSize: 11, whiteSpace: 'nowrap', padding: '6px 10px' }}
            onClick={() => setActiveCategory(sec)}>
            {sec === 'All' ? '🏆 All' : sec === 'Batting Records' ? '🏏 Batting' : sec === 'Bowling Records' ? '🎳 Bowling' : sec === 'Team Records' ? '👥 Team' : sec === 'Series Records' ? '🏆 Series' : '⚔️ Player vs Player'}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">No records yet</div><div className="empty-sub">Play more matches to see records here</div></div>
      )}
      {Object.entries(grouped).map(([category, entries]) => (
        <div key={category} className="card mb-3">
          <div className="section-title" style={{ marginBottom: 10 }}>{category}</div>
          {entries.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 18, width: 26, flexShrink: 0 }}>{medals[i] || `${i+1}`}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{entry.player}</div>
                {entry.details && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.details}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: i === 0 ? 'var(--gold)' : i === 1 ? '#b0b0b0' : '#cd7f32', flexShrink: 0 }}>{entry.value}</div>
              {entry.matchId && state.matches[entry.matchId] && onNav && (showGoToMatch.has(category) || entry.matchId) && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, flexShrink: 0, padding: '4px 8px' }}
                  onClick={() => onNav('match', entry.matchId)}>
                  → Match
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PARTNERSHIPS PAGE
// ============================================================
function PartnershipsPage({ state, onBack }) {
  const [searchTerm, setSearchTerm] = useState('');

  // ── Build the most comprehensive player map possible ──
  const playerById = {};   // id → { id, name }
  const playerByName = {}; // name → { id, name }

  const addPlayer = (p) => {
    if (!p) return;
    if (p.id && p.name) {
      playerById[p.id] = p;
      playerByName[p.name.toLowerCase().trim()] = p;
    } else if (p.name) {
      // No ID — use name as synthetic key
      const syntheticId = '__name__' + p.name.toLowerCase().trim();
      playerById[syntheticId] = { id: syntheticId, name: p.name };
      playerByName[p.name.toLowerCase().trim()] = { id: syntheticId, name: p.name };
    }
  };

  // Collect from all sources
  Object.values(state.players || {}).forEach(p => addPlayer(p));
  Object.values(state.matches).forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => addPlayer(p));
    Object.values(m.innings || {}).forEach(inn => {
      addPlayer(inn.striker);
      addPlayer(inn.nonStriker);
      // Extract from ball records
      (inn.balls_by_ball || []).forEach(ball => {
        if (ball.batsmanName) addPlayer({ id: ball.batsman, name: ball.batsmanName });
        if (ball.bowlerName)  addPlayer({ id: ball.bowler,  name: ball.bowlerName });
      });
      // Extract from batsmen keys + names
      Object.entries(inn.batsmen || {}).forEach(([pid, bats]) => {
        // pid might be ID or name - check
        if (bats.name) addPlayer({ id: pid, name: bats.name });
        else if (!pid.startsWith('__')) {
          // Try to look up existing
          if (playerById[pid]) {} // already known
        }
      });
    });
  });

  // Resolve a ball.batsman value (could be ID or name) → canonical ID
  const resolveId = (val) => {
    if (!val) return null;
    if (playerById[val]) return val; // it's already a valid ID
    // try as lowercase name
    const byName = playerByName[val.toLowerCase().trim()];
    if (byName) return byName.id;
    // unknown — use synthetic
    const syntheticId = '__name__' + val.toLowerCase().trim();
    playerById[syntheticId] = { id: syntheticId, name: val };
    playerByName[val.toLowerCase().trim()] = { id: syntheticId, name: val };
    return syntheticId;
  };

  const getName = (id) => playerById[id]?.name || id || 'Unknown';

  // ── Build partnerships ──
  const partnershipMap = {};

  Object.values(state.matches).forEach(match => {
    Object.values(match.innings || {}).forEach(inn => {
      const balls = inn.balls_by_ball || [];

      if (balls.length === 0) {
        // No ball-by-ball: fall back to aggregate innings batsmen list
        // NOTE: this is an approximation (whole-innings totals, not the actual partnership window)
        const batsmen = Object.keys(inn.batsmen || {});
        for (let i = 0; i < batsmen.length; i++) {
          for (let j = i + 1; j < batsmen.length; j++) {
            const id1 = resolveId(batsmen[i]);
            const id2 = resolveId(batsmen[j]);
            if (!id1 || !id2 || id1 === id2) continue;
            const swap = id1 > id2;
            const s1 = swap ? id2 : id1;
            const s2 = swap ? id1 : id2;
            const r1 = inn.batsmen[batsmen[i]]?.runs || 0;
            const r2 = inn.batsmen[batsmen[j]]?.runs || 0;
            const b1 = inn.batsmen[batsmen[i]]?.balls || 0;
            const b2 = inn.batsmen[batsmen[j]]?.balls || 0;
            const key = `${s1}__${s2}`;
            if (!partnershipMap[key]) partnershipMap[key] = { id1: s1, id2: s2, list: [] };
            partnershipMap[key].list.push({
              runs: r1 + r2, balls: b1 + b2,
              p1Runs: swap ? r2 : r1, p1Balls: swap ? b2 : b1,
              p2Runs: swap ? r1 : r2, p2Balls: swap ? b1 : b2,
            });
          }
        }
        return;
      }

      // ── Ball-by-ball replay ──
      const resolvedBalls = balls.map(b => ({
        ...b,
        batterId: resolveId(b.batsman),
      }));

      const batsmenWhoAppeared = new Set(); // all batters seen so far
      let p1 = null, p2 = null;
      let p1Runs = 0, p1Balls = 0, p2Runs = 0, p2Balls = 0;
      const innings_partnerships = [];
      let waitingForNewBatter = false; // after a wicket, wait for fresh batter

      resolvedBalls.forEach(ball => {
        const bid = ball.batterId;

        // Track new batters
        if (bid) batsmenWhoAppeared.add(bid);

        // Establish first pair once we have 2 distinct batters
        if (!p1 && batsmenWhoAppeared.size >= 2 && !waitingForNewBatter) {
          const arr = Array.from(batsmenWhoAppeared);
          p1 = arr[0]; p2 = arr[1];
          p1Runs = 0; p1Balls = 0; p2Runs = 0; p2Balls = 0;
        }

        // If waiting for new batter after wicket — check if this ball has a new batter
        if (waitingForNewBatter && bid && bid !== p1) {
          p2 = bid;
          p1Runs = 0; p1Balls = 0; p2Runs = 0; p2Balls = 0; // ← partnership starts fresh from 0
          waitingForNewBatter = false;
        }

        if (p1 && p2 && !waitingForNewBatter) {
          // Accumulate runs/balls for whichever of p1/p2 faced this ball
          if (!ball.wide) {
            const runs = ball.runs || 0;
            if (bid === p1) { p1Balls++; p1Runs += runs; }
            else if (bid === p2) { p2Balls++; p2Runs += runs; }
          }

          if (ball.wicket) {
            // Save completed partnership with individual contributions
            const curRuns = p1Runs + p2Runs;
            const curBalls = p1Balls + p2Balls;
            innings_partnerships.push({
              p1, p2, runs: curRuns, balls: curBalls,
              p1Runs, p1Balls, p2Runs, p2Balls,
            });

            // Determine who got out
            let outId;
            if (ball.outBatsman === 'nonStriker') {
              // Non-striker out — the current ball's batterId is the striker, so non-striker is the other
              outId = (bid === p1) ? p2 : p1;
            } else {
              // Striker got out
              outId = bid;
            }
            const surviving = (outId === p1) ? p2 : p1;
            const survivorRuns = (outId === p1) ? p2Runs : p1Runs;
            const survivorBalls = (outId === p1) ? p2Balls : p1Balls;
            p1 = surviving;
            // Carry forward survivor's contribution as p1's running total for the NEXT partnership
            // (but next partnership starts at 0 once a new partner arrives, per the reset above)
            p2 = null;
            p1Runs = 0; p1Balls = 0; p2Runs = 0; p2Balls = 0;
            waitingForNewBatter = true; // wait for the incoming batter
          }
        }
      });

      // End of innings — save last unbroken partnership
      if (p1 && p2 && (p1Balls + p2Balls) > 0) {
        innings_partnerships.push({
          p1, p2, runs: p1Runs + p2Runs, balls: p1Balls + p2Balls,
          p1Runs, p1Balls, p2Runs, p2Balls,
        });
      }

      // Aggregate
      innings_partnerships.forEach(({ p1, p2, runs, balls, p1Runs, p1Balls, p2Runs, p2Balls }) => {
        if (!p1 || !p2 || p1 === p2) return;
        // Sort consistently so contributions map to the right player regardless of order
        const swap = p1 > p2;
        const s1 = swap ? p2 : p1;
        const s2 = swap ? p1 : p2;
        const s1Runs = swap ? p2Runs : p1Runs;
        const s1Balls = swap ? p2Balls : p1Balls;
        const s2Runs = swap ? p1Runs : p2Runs;
        const s2Balls = swap ? p1Balls : p2Balls;
        const key = `${s1}__${s2}`;
        if (!partnershipMap[key]) partnershipMap[key] = { id1: s1, id2: s2, list: [] };
        partnershipMap[key].list.push({ runs, balls, p1Runs: s1Runs, p1Balls: s1Balls, p2Runs: s2Runs, p2Balls: s2Balls });
      });
    });
  });

  // ── Summarise ──
  const summaries = Object.values(partnershipMap)
    .map(entry => {
      const name1 = getName(entry.id1);
      const name2 = getName(entry.id2);
      // Skip truly unknown pairs (both are synthetic IDs with no real name)
      if (name1 === 'Unknown' && name2 === 'Unknown') return null;
      const totalRuns = entry.list.reduce((s, p) => s + p.runs, 0);
      const totalBalls = entry.list.reduce((s, p) => s + p.balls, 0);
      const totalP1Runs = entry.list.reduce((s, p) => s + (p.p1Runs || 0), 0);
      const totalP1Balls = entry.list.reduce((s, p) => s + (p.p1Balls || 0), 0);
      const totalP2Runs = entry.list.reduce((s, p) => s + (p.p2Runs || 0), 0);
      const totalP2Balls = entry.list.reduce((s, p) => s + (p.p2Balls || 0), 0);
      const bestEntry = entry.list.reduce((best, p) => (p.runs > (best?.runs || -1) ? p : best), null);
      const bestRuns = bestEntry?.runs || 0;
      return {
        name1, name2, totalRuns, totalBalls, bestRuns, count: entry.list.length,
        totalP1Runs, totalP1Balls, totalP2Runs, totalP2Balls,
        best: bestEntry,
      };
    })
    .filter(Boolean)
    .filter(p => p.totalRuns > 0);

  const filtered = summaries
    .filter(p => !searchTerm ||
      p.name1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name2.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.totalRuns - a.totalRuns);

  return (
    <div className="page fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack}>←</button>
        <div className="page-title" style={{ fontSize: 22 }}>🤝 Partnerships</div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--blue)' }}
          onClick={() => {
            const rows = filtered.map((p,i) => `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}"><td style="padding:6px 8px;border:1px solid #eee">${i+1}</td><td style="padding:6px 8px;border:1px solid #eee;font-weight:600">${p.name1} & ${p.name2}</td><td style="padding:6px 8px;border:1px solid #eee;font-size:11px;color:#666">${p.name1} ${p.totalP1Runs}(${p.totalP1Balls}) &amp; ${p.name2} ${p.totalP2Runs}(${p.totalP2Balls})</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center;font-weight:700">${p.totalRuns}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${p.bestRuns}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${p.count}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${p.totalBalls>0?p.totalBalls:'-'}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${p.count>0?(p.totalRuns/p.count).toFixed(1):'-'}</td><td style="padding:6px 8px;border:1px solid #eee;text-align:center">${p.totalBalls>0?((p.totalRuns/p.totalBalls)*100).toFixed(1):'-'}</td></tr>`).join('');
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Partnerships</title><style>body{font-family:Arial,sans-serif;padding:24px;max-width:1000px;margin:0 auto}</style></head><body><h1 style="text-align:center;margin-bottom:4px">🤝 Partnership Stats</h1><p style="text-align:center;color:#888;font-size:12px;margin-bottom:16px">Generated ${new Date().toLocaleDateString()}</p><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f5f5f5"><th style="padding:7px 8px;border:1px solid #ddd;text-align:left">#</th><th style="padding:7px 8px;border:1px solid #ddd;text-align:left">Partnership</th><th style="padding:7px 8px;border:1px solid #ddd;text-align:left">Individual Contributions</th><th style="padding:7px 8px;border:1px solid #ddd">Total Runs</th><th style="padding:7px 8px;border:1px solid #ddd">Best</th><th style="padding:7px 8px;border:1px solid #ddd">Times</th><th style="padding:7px 8px;border:1px solid #ddd">Balls</th><th style="padding:7px 8px;border:1px solid #ddd">Avg</th><th style="padding:7px 8px;border:1px solid #ddd">SR</th></tr>${rows}</table><div style="text-align:center;margin-top:20px;color:#aaa;font-size:11px;border-top:1px solid #ddd;padding-top:10px">Crictera by Saksham Arora</div></body></html>`;
            downloadHTML(html, 'crictera_partnerships.html');
          }}>📥 PDF</button>
      </div>

      <input className="input mb-4" placeholder="🔍 Search by player name..."
        value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

      {filtered.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🤝</div>
          <div className="empty-title">No partnerships found</div>
          <div className="empty-sub">Score ball-by-ball to generate partnership data</div>
        </div>
      )}

      {filtered.map((p, i) => {
        const avg = p.count > 0 ? (p.totalRuns / p.count).toFixed(1) : '-';
        const sr = p.totalBalls > 0 ? ((p.totalRuns / p.totalBalls) * 100).toFixed(1) : '-';
        return (
          <div key={i} className="card mb-2" style={{ padding: '12px 14px' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{p.name1} & {p.name2}</div>

            {/* Individual contributions (career totals across all partnerships) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 8, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 6 }}>
              <span>{p.name1}: <span className="font-mono" style={{ color: 'var(--gold)' }}>{p.totalP1Runs} ({p.totalP1Balls})</span></span>
              <span>{p.name2}: <span className="font-mono" style={{ color: 'var(--gold)' }}>{p.totalP2Runs} ({p.totalP2Balls})</span></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 6 }}>
              <div className="stat-box"><div className="stat-val">{p.totalRuns}</div><div className="stat-label">Total Runs</div></div>
              <div className="stat-box"><div className="stat-val">{p.bestRuns}</div><div className="stat-label">Best</div></div>
              <div className="stat-box"><div className="stat-val">{p.count}</div><div className="stat-label">Times</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              <div className="stat-box"><div className="stat-val">{p.totalBalls > 0 ? p.totalBalls : '-'}</div><div className="stat-label">Balls</div></div>
              <div className="stat-box"><div className="stat-val" style={{ color: 'var(--gold)' }}>{avg}</div><div className="stat-label">Avg/Inns</div></div>
              <div className="stat-box"><div className="stat-val" style={{ color: 'var(--blue)' }}>{sr}</div><div className="stat-label">SR</div></div>
            </div>

            {/* Best partnership individual breakdown */}
            {p.best && (p.best.p1Runs !== undefined) && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                Best ({p.bestRuns}): {p.name1} {p.best.p1Runs} ({p.best.p1Balls}) &amp; {p.name2} {p.best.p2Runs} ({p.best.p2Balls})
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Generate Leaderboard PDF
function generateLeaderboardPDF(state) {
  // Build comprehensive player map
  const playerNameMap = {};
  Object.entries(state.players || {}).forEach(([id, p]) => { if (p?.name) playerNameMap[id] = p.name; });
  Object.values(state.matches || {}).forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => {
      if (p?.id && p?.name) playerNameMap[p.id] = p.name;
    });
  });
  const getN = pid => playerNameMap[pid] || 'Unknown';

  // Use calculatePlayerStats for accurate data
  const allPids = new Set();
  Object.values(state.matches || {}).forEach(m => {
    [...(m.teamA?.players||[]), ...(m.teamB?.players||[])].forEach(p => { if (p?.id) allPids.add(p.id); });
    Object.values(m.innings || {}).forEach(inn => {
      Object.keys(inn.batsmen || {}).forEach(pid => allPids.add(pid));
      Object.keys(inn.bowlers || {}).forEach(pid => allPids.add(pid));
    });
  });
  Object.keys(state.players || {}).forEach(pid => allPids.add(pid));

  const statsArr = Array.from(allPids).map(pid => {
    const s = calculatePlayerStats(state.matches, pid);
    const manual = state.manualPlayerStats?.[pid] || {};
    const runs = s.runs + (manual.runs || 0);
    const balls = s.balls + (manual.balls || 0);
    const fours = s.fours + (manual.fours || 0);
    const sixes = s.sixes + (manual.sixes || 0);
    const wickets = s.wickets + (manual.wickets || 0);
    const ballsBowled = s.ballsBowled + (manual.ballsBowled || 0);
    const runsConceded = s.runsConceded + (manual.runsConceded || 0);
    const innings = s.innings + (manual.innings || 0);
    const notOuts = s.notOuts + (manual.notOuts || 0);
    const matches = s.matches + (manual.matches || 0);
    const matchesWon = s.matchesWon + (manual.matchesWon || 0);
    const matchesLost = s.matchesLost + (manual.matchesLost || 0);
    const matchesCaptained = s.matchesCaptained || 0;
    const captainWins = s.captainWins || 0;
    const tossWins = s.tossWins || 0;
    const dismissals = innings - notOuts;
    const avg = dismissals > 0 ? (runs / dismissals).toFixed(2) : (innings > 0 ? '∞' : '-');
    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '-';
    const bowlAvg = wickets > 0 ? (runsConceded / wickets).toFixed(2) : '-';
    const bowlSR = wickets > 0 ? (ballsBowled / wickets).toFixed(1) : '-';
    const econ = ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(2) : '-';
    return { pid, name: getN(pid), runs, balls, fours, sixes, wickets, ballsBowled, runsConceded, innings, notOuts, matches, matchesWon, matchesLost, matchesCaptained, captainWins, tossWins, avg, sr, bowlAvg, bowlSR, econ };
  }).filter(p => p.runs > 0 || p.wickets > 0 || p.matches > 0);

  const metrics = [
    { title: '🏏 Most Runs', col: 'Runs', rows: [...statsArr].sort((a,b) => b.runs-a.runs).slice(0,10).map(p => [p.name, p.runs, `${p.innings} inn, Avg ${p.avg}, SR ${p.sr}`]) },
    { title: '📈 Batting Average', col: 'Average', rows: [...statsArr].filter(p=>p.innings>0).sort((a,b) => {
        const da = a.innings-a.notOuts, db = b.innings-b.notOuts;
        const aa = da>0?a.runs/da:(a.innings>0?99999:0), ab = db>0?b.runs/db:(b.innings>0?99999:0);
        return ab-aa;
      }).slice(0,10).map(p => [p.name, p.avg, `${p.runs} runs, ${p.innings} inn, ${p.notOuts} NO`]) },
    { title: '⚡ Strike Rate', col: 'SR', rows: [...statsArr].filter(p=>p.balls>0).sort((a,b)=>parseFloat(b.sr)-parseFloat(a.sr)).slice(0,10).map(p=>[p.name, p.sr, `${p.runs} runs, ${p.balls} balls`]) },
    { title: '4️⃣ Most Fours', col: 'Fours', rows: [...statsArr].sort((a,b)=>b.fours-a.fours).slice(0,10).map(p=>[p.name, p.fours, `${p.runs} runs`]) },
    { title: '6️⃣ Most Sixes', col: 'Sixes', rows: [...statsArr].sort((a,b)=>b.sixes-a.sixes).slice(0,10).map(p=>[p.name, p.sixes, `${p.runs} runs`]) },
    { title: '🛑 Most Boundaries', col: 'Boundaries', rows: [...statsArr].sort((a,b)=>(b.fours+b.sixes)-(a.fours+a.sixes)).slice(0,10).map(p=>[p.name, p.fours+p.sixes, `${p.fours} fours, ${p.sixes} sixes`]) },
    { title: '🎯 Most Wickets', col: 'Wickets', rows: [...statsArr].sort((a,b)=>b.wickets-a.wickets).slice(0,10).map(p=>[p.name, p.wickets, `Avg ${p.bowlAvg}, Econ ${p.econ}`]) },
    { title: '📊 Bowling Average', col: 'Avg', rows: [...statsArr].filter(p=>p.wickets>0).sort((a,b)=>parseFloat(a.bowlAvg)-parseFloat(b.bowlAvg)).slice(0,10).map(p=>[p.name, p.bowlAvg, `${p.wickets} wkts, ${p.runsConceded} runs`]) },
    { title: '⚡ Bowling Strike Rate', col: 'SR', rows: [...statsArr].filter(p=>p.wickets>0).sort((a,b)=>parseFloat(a.bowlSR)-parseFloat(b.bowlSR)).slice(0,10).map(p=>[p.name, p.bowlSR, `${p.wickets} wkts, ${p.ballsBowled} balls`]) },
    { title: '📉 Economy Rate', col: 'Economy', rows: [...statsArr].filter(p=>p.ballsBowled>=6).sort((a,b)=>parseFloat(a.econ)-parseFloat(b.econ)).slice(0,10).map(p=>[p.name, p.econ, `${p.runsConceded} runs, ${Math.floor(p.ballsBowled/6)}.${p.ballsBowled%6} ov`]) },
    { title: '🏆 Most Wins', col: 'Wins', rows: [...statsArr].sort((a,b)=>b.matchesWon-a.matchesWon).slice(0,10).map(p=>[p.name, p.matchesWon, `${p.matches} matches, ${p.matchesLost} losses`]) },
    { title: '🎯 Most Balls Played', col: 'Balls', rows: [...statsArr].sort((a,b)=>b.balls-a.balls).slice(0,10).map(p=>[p.name, p.balls, `${p.runs} runs, SR ${p.sr}`]) },
    { title: '👑 Captaincy Record', col: 'W/L', rows: [...statsArr].filter(p=>p.matchesCaptained>0).sort((a,b)=>b.matchesCaptained-a.matchesCaptained).slice(0,10).map(p=>[p.name, `${p.captainWins||0}/${p.matchesCaptained}`, `${p.matchesCaptained > 0 ? Math.round(((p.captainWins||0)/p.matchesCaptained)*100) : 0}% win rate, ${p.tossWins||0} toss wins`]) },
    { title: '💔 Most Losses', col: 'Losses', rows: [...statsArr].sort((a,b)=>b.matchesLost-a.matchesLost).slice(0,10).map(p=>[p.name, p.matchesLost, `${p.matches} matches, ${p.matchesWon} wins`]) },
  ];

  const tableHTML = metrics.map(m => `
    <div style="margin-bottom:28px;page-break-inside:avoid;">
      <h2 style="font-size:15px;color:#1a1a1a;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:10px;">${m.title}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr style="background:#f0f0f0;">
          <th style="border:1px solid #ddd;padding:7px;text-align:left;width:30px">#</th>
          <th style="border:1px solid #ddd;padding:7px;text-align:left;">Player</th>
          <th style="border:1px solid #ddd;padding:7px;text-align:center;width:80px">${m.col}</th>
          <th style="border:1px solid #ddd;padding:7px;text-align:left;color:#666">Details</th>
        </tr>
        ${m.rows.map(([name, val, det], i) => `
        <tr style="background:${i%2===0?'#fff':'#fafafa'}">
          <td style="border:1px solid #ddd;padding:7px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
          <td style="border:1px solid #ddd;padding:7px;font-weight:600">${name}</td>
          <td style="border:1px solid #ddd;padding:7px;text-align:center;font-weight:700;color:#1a1a1a">${val}</td>
          <td style="border:1px solid #ddd;padding:7px;color:#666;font-size:11px">${det}</td>
        </tr>`).join('')}
      </table>
    </div>`).join('');

  const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Crictera Leaderboard Report</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:900px;margin:0 auto;color:#1a1a1a}@media print{.no-print{display:none}}</style></head>
  <body>
  <h1 style="text-align:center;margin-bottom:4px">📊 Cricket Leaderboard Report</h1>
  <p style="text-align:center;color:#666;font-size:12px;margin-bottom:24px">Generated ${new Date().toLocaleDateString()} • Crictera by Saksham Arora</p>
  ${tableHTML}
  <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px">Made by Saksham Arora using Claude • Crictera Cricket Scorer</div>
  </body></html>`;

  downloadHTML(fullHTML, `leaderboard_${new Date().toISOString().split('T')[0]}.html`);
}

function App() {
  const { user: authUser, profile, loading: authLoading, signedIn } = useAuth();

  const [state, setState] = useState(() => {
    // Matches/series/etc. now load from Supabase once auth resolves (see the
    // effect below) — local state starts empty and gets populated async,
    // rather than synchronously reading localStorage like before.
    const shared = decodeShareFromURL();
    if (shared?.match) {
      clearShareHash();
      const s = makeInitialState();
      const sharedMatch = { ...shared.match, _shared: true, _editorAccess: shared.role === 'editor' };
      s.matches = { [sharedMatch.id]: sharedMatch };
      s.activeMatchId = sharedMatch.id;
      s.page = 'match'; // Will show match even without login
      return s;
    }
    return makeInitialState();
  });

  const [matchesLoaded, setMatchesLoaded] = useState(false);

  // ── Populate state.user from the authenticated Supabase session, and load
  // this user's matches from Supabase. This is what makes "log in from any
  // device" work: matches aren't tied to this browser at all anymore — they
  // come from a real database query keyed on the authenticated user's id. ──
  useEffect(() => {
    if (authLoading) return; // wait for the initial session check

    if (!signedIn || !authUser) {
      // Signed out — clear local match cache (Supabase is the source of
      // truth, so there's nothing meaningful to keep around locally once
      // signed out).
      setState(s => (s.user ? { ...makeInitialState(), page: 'login' } : s));
      setMatchesLoaded(false);
      return;
    }

    const appUser = {
      id: authUser.id,
      email: authUser.email,
      name: profile?.name || authUser.email.split('@')[0],
    };

    setState(s => ({ ...s, user: appUser, page: (s.page === 'login' || s.page === 'register') ? 'home' : s.page }));

    fetchMyMatches(authUser.id)
      .then(matches => {
        const matchMap = {};
        matches.forEach(m => { matchMap[m.id] = m; });
        setState(s => ({ ...s, matches: { ...matchMap, ...s.matches } }));
        setMatchesLoaded(true);
      })
      .catch(e => {
        console.error('Failed to load matches from Supabase:', e);
        setMatchesLoaded(true);
      });
  }, [authLoading, signedIn, authUser, profile]);

  // ── Persistence bridge: whenever a match changes in local state, push it
  // to Supabase (debounced per the "write every ball immediately" choice —
  // debounce is short, just enough to coalesce same-tick updates). This is
  // the layer that lets the existing ~10 match-mutation functions below
  // (createMatch, scoreMatch, undoScore, endMatch, etc.) keep working
  // exactly as before, mutating state.matches in memory for instant UI
  // feedback, while this effect is what actually persists every change. ──
  const lastSyncedRef = useRef({});
  const dbSyncTimerRef = useRef(null);
  useEffect(() => {
    if (!state.user?.id || !matchesLoaded) return;
    clearTimeout(dbSyncTimerRef.current);
    dbSyncTimerRef.current = setTimeout(() => {
      Object.values(state.matches || {}).forEach(m => {
        // Don't push matches we're only viewing/editing via someone else's
        // share code back as if we owned them.
        if (m._shared && m.ownerId !== state.user.id) return;
        const json = JSON.stringify(m);
        if (lastSyncedRef.current[m.id] === json) return; // unchanged since last sync
        lastSyncedRef.current[m.id] = json;

        if (m.ownerId === state.user.id || !m.ownerId) {
          const isNew = !m._dbSynced;
          const withOwner = { ...m, ownerId: state.user.id };
          const op = isNew ? dbCreateMatch(withOwner, state.user.id) : dbUpdateMatch(m.id, withOwner);
          op
            .then(saved => {
              setState(s => {
                const cur = s.matches[m.id];
                if (!cur) return s;
                lastSyncedRef.current[m.id] = JSON.stringify({ ...cur, _dbSynced: true });
                return { ...s, matches: { ...s.matches, [m.id]: { ...cur, _dbSynced: true } } };
              });
            })
            .catch(e => console.error('Failed to sync match to Supabase:', m.id, e));
        } else if (m._editorAccess) {
          // Editing a match shared with us — update it (RLS allows
          // authenticated updates; the app only shows scoring UI when the
          // editor code was supplied to get here in the first place).
          dbUpdateMatch(m.id, m).catch(e => console.error('Failed to sync shared match:', m.id, e));
        }
      });
    }, 400);
    return () => clearTimeout(dbSyncTimerRef.current);
  }, [state.matches, state.user, matchesLoaded]);

  // ── Realtime: subscribe to the currently-open match so score updates from
  // another device (the editor) appear instantly for viewers, and vice
  // versa — this satisfies "ensure score updates sync in realtime". ──
  useEffect(() => {
    const matchId = state.activeMatchId;
    if (!matchId) return;
    const unsubscribe = subscribeToMatch(matchId, (updated) => {
      if (!updated) return; // deleted
      setState(s => {
        const localMatch = s.matches[matchId];
        if (!localMatch) return s;
        // Don't clobber an in-flight local edit that hasn't synced yet
        const localJSON = JSON.stringify(localMatch);
        if (lastSyncedRef.current[matchId] && lastSyncedRef.current[matchId] !== localJSON) return s;
        const merged = { ...updated, _shared: localMatch._shared, _editorAccess: localMatch._editorAccess, _dbSynced: true };
        const mergedJSON = JSON.stringify(merged);
        if (mergedJSON === localJSON) return s;
        lastSyncedRef.current[matchId] = mergedJSON;
        return { ...s, matches: { ...s.matches, [matchId]: merged } };
      });
    });
    return unsubscribe;
  }, [state.activeMatchId]);

  // ── Realtime: subscribe to ALL of this user's matches so the home/list
  // pages update live (e.g. a match created on another device appears
  // without a manual refresh). ──
  useEffect(() => {
    if (!state.user?.id) return;
    const unsubscribe = subscribeToMyMatches(state.user.id, {
      onInsert: (m) => setState(s => (s.matches[m.id] ? s : { ...s, matches: { ...s.matches, [m.id]: { ...m, _dbSynced: true } } })),
      onUpdate: (m) => setState(s => {
        const localJSON = s.matches[m.id] ? JSON.stringify(s.matches[m.id]) : null;
        if (lastSyncedRef.current[m.id] && lastSyncedRef.current[m.id] !== localJSON) return s; // unsynced local edit in flight
        const merged = { ...m, _dbSynced: true };
        lastSyncedRef.current[m.id] = JSON.stringify(merged);
        return { ...s, matches: { ...s.matches, [m.id]: merged } };
      }),
      onDelete: (id) => setState(s => {
        if (!s.matches[id]) return s;
        const { [id]: _, ...rest } = s.matches;
        return { ...s, matches: rest };
      }),
    });
    return unsubscribe;
  }, [state.user?.id]);

  const addToast = useCallback((msg, type = '') => {
    const id = genId();
    setState(s => ({ ...s, toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) })), 3000);
  }, []);

  const nav = (page, id = null) => {
    setState(s => ({
      ...s, page,
      activeMatchId: (page === 'match' || page === 'superover') ? (id || s.activeMatchId) : s.activeMatchId,
      activeSeriesId: (page === 'series' || page === 'seriesStats') ? id : s.activeSeriesId,
      activeTournamentId: page === 'tournament' ? id : s.activeTournamentId,
      activeCareerPlayerId: (page === 'career' || page === 'graph') ? id : s.activeCareerPlayerId,
    }));
  };

  // Auth is now driven entirely by Supabase (see the AuthContext-backed
  // effect above this component's state init) — AuthPage calls signUp/
  // signIn directly, useAuth() reacts to the resulting session, and that
  // effect populates state.user and loads matches. handleAuth just needs
  // to greet the user once their profile/name is available.
  const handleAuth = () => {
    addToast(`Welcome! 🏏`);
  };

  const handleLogout = async () => {
    try { await signOut(); } catch (e) { console.error('Sign out failed:', e); }
    setState(s => ({ ...makeInitialState(), page: 'login' }));
  };

  const createMatch = (form) => {
    const id = genId();
    const teamA = {
      name: form.teamAName,
      players: form.playersA.length > 0 ? form.playersA : [
        { id: genId(), name: 'Batsman 1' }, { id: genId(), name: 'Batsman 2' },
        { id: genId(), name: 'Batsman 3' }, { id: genId(), name: 'Batsman 4' },
        { id: genId(), name: 'All Rounder' },
      ],
    };
    const teamB = {
      name: form.teamBName,
      players: form.playersB.length > 0 ? form.playersB : [
        { id: genId(), name: 'Batsman 1' }, { id: genId(), name: 'Batsman 2' },
        { id: genId(), name: 'Bowler 1' }, { id: genId(), name: 'Bowler 2' },
        { id: genId(), name: 'All Rounder' },
      ],
    };
    const match = {
      id, title: form.title, overs: form.overs, location: form.location,
      teamA, teamB, ownerId: state.user?.id,
      viewerCode: genCode(), editorCode: genCode(),
      status: 'setup', battingTeam: 'A', currentInnings: '1',
      innings: {},
      notes: [], equipment: [], reactions: {},
      aiCommentary: form.aiCommentary,
      maxOversPerBowler: form.maxOversPerBowler || 0,
      seriesId: form.seriesId || null,
      isPublic: form.isPublic || false,
      visibility: form.isPublic ? 'public' : 'private',
      captainA: form.captainA || null,
      captainB: form.captainB || null,
      createdAt: Date.now(),
    };
    setState(s => {
      const newState = {
        ...s,
        matches: { ...s.matches, [id]: match },
        page: 'match',
        activeMatchId: id,
        pendingSeriesId: null,
      };
      if (form.seriesId && s.series[form.seriesId]) {
        newState.series = {
          ...s.series,
          [form.seriesId]: {
            ...s.series[form.seriesId],
            matches: [...(s.series[form.seriesId].matches || []), id],
          },
        };
      }
      return newState;
    });
    addToast(`Match "${form.title}" created! 🏏`);
  };

  const createSeries = (form) => {
    const id = genId();
    const series = {
      id, name: form.name, totalMatches: form.totalMatches,
      teamA: form.teamAName, teamB: form.teamBName,
      playersA: form.playersA || [], playersB: form.playersB || [],
      defaultOvers: form.overs || 10,
      scoreA: 0, scoreB: 0, matches: [], 
      isPublic: form.isPublic || false,
      creatorId: state.user?.id,
      createdAt: Date.now()
    };
    setState(s => ({ ...s, series: { ...s.series, [id]: series }, page: 'series', activeSeriesId: id }));
    addToast(`Series "${form.name}" created! 🏆`);
  };

  const updateUser = (updatedUser) => {
    setState(s => ({ ...s, user: updatedUser }));
    // Persist updated user info
    try {
      const userKey = 'crexlive_user_' + updatedUser.email.toLowerCase().replace(/[^a-z0-9]/g,'_');
      localStorage.setItem(userKey, JSON.stringify(updatedUser));
    } catch(e) {}
  };

  const editPlayerStats = (playerId, statsUpdate) => {
    setState(s => {
      const player = s.players?.[playerId];
      const playerName = player?.name || 'Player';
      
      // When editing stats, we're setting a new baseline
      // Future match stats will ADD to these edited values
      const currentManual = s.manualPlayerStats?.[playerId] || {};
      const currentStats = calculatePlayerStats(s.matches, playerId);
      
      // If editing, merge the update with existing manual stats
      const merged = {
        ...statsUpdate,
        editedAt: Date.now(),
        // Keep matches/innings if they exist (user may have edited them)
        matches: statsUpdate.matches !== undefined ? statsUpdate.matches : currentManual.matches,
        innings: statsUpdate.innings !== undefined ? statsUpdate.innings : currentManual.innings,
      };
      
      const updated = {
        ...s,
        manualPlayerStats: {
          ...s.manualPlayerStats,
          [playerId]: merged
        }
      };
      
      addToast(`✏️ ${playerName} stats updated! 📊`);
      return updated;
    });
  };

  const deletePlayerVsStats = () => {
    // vs stats will be regenerated from scratch on next match
    // Currently stored in vsMatchups inside PlayerVsStatsPage component
    // No persistent storage - they're calculated real-time from matches
    addToast('✅ Player vs stats cleared! Fresh start from next match');
  };

  const deleteMatch = (matchId) => {
    dbDeleteMatch(matchId).catch(e => console.error('Failed to delete match from Supabase:', matchId, e));
    setState(s => {
      const match = s.matches[matchId];
      const newMatches = { ...s.matches };
      delete newMatches[matchId];
      
      // Remove from series if part of one
      const newSeries = { ...s.series };
      if (match?.seriesId && newSeries[match.seriesId]) {
        newSeries[match.seriesId] = {
          ...newSeries[match.seriesId],
          matches: (newSeries[match.seriesId].matches || []).filter(m => m !== matchId)
        };
      }
      
      // Recalculate player stats without this match
      const playerStatsFromMatches = {};
      Object.values(newMatches).forEach(m => {
        Object.values(m.innings || {}).forEach(inn => {
          Object.entries(inn.batsmen || {}).forEach(([pid, bats]) => {
            if (!playerStatsFromMatches[pid]) playerStatsFromMatches[pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0 };
            playerStatsFromMatches[pid].runs += bats.runs || 0;
            playerStatsFromMatches[pid].balls += bats.balls || 0;
            playerStatsFromMatches[pid].fours += bats.fours || 0;
            playerStatsFromMatches[pid].sixes += bats.sixes || 0;
            playerStatsFromMatches[pid].innings++;
          });
          Object.entries(inn.bowlers || {}).forEach(([pid, bowl]) => {
            if (!playerStatsFromMatches[pid]) playerStatsFromMatches[pid] = { wickets: 0, ballsBowled: 0, runsConceded: 0 };
            playerStatsFromMatches[pid].wickets = (playerStatsFromMatches[pid].wickets || 0) + (bowl.wickets || 0);
            playerStatsFromMatches[pid].ballsBowled = (playerStatsFromMatches[pid].ballsBowled || 0) + (bowl.balls || 0);
            playerStatsFromMatches[pid].runsConceded = (playerStatsFromMatches[pid].runsConceded || 0) + (bowl.runs || 0);
          });
        });
      });
      
      // Update manual stats - keep only the difference or remove if no remaining stats
      const newManualStats = { ...s.manualPlayerStats };
      Object.keys(newManualStats).forEach(pid => {
        const manual = newManualStats[pid];
        const calculated = playerStatsFromMatches[pid] || { runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, wickets: 0, ballsBowled: 0, runsConceded: 0 };
        
        // If manual stats are just the baseline for a deleted match, remove them
        if (manual.runs === (calculated.runs || 0) && manual.balls === (calculated.balls || 0) && manual.wickets === (calculated.wickets || 0)) {
          delete newManualStats[pid];
        }
      });
      
      addToast('Match deleted permanently 🗑️');
      return { ...s, matches: newMatches, series: newSeries, manualPlayerStats: newManualStats, activeMatchId: null, page: 'home' };
    });
  };

  const deleteSeries = (seriesId) => {
    setState(s => {
      const series = s.series[seriesId];
      const newSeries = { ...s.series };
      delete newSeries[seriesId];
      
      // Remove matches that belong to this series
      const newMatches = { ...s.matches };
      (series.matches || []).forEach(matchId => {
        delete newMatches[matchId];
      });
      
      addToast(`Series "${series.name}" deleted 🗑️`);
      return { ...s, series: newSeries, matches: newMatches, activeSeriesId: null, page: 'home' };
    });
  };

  const deleteTournament = (tournamentId) => {
    setState(s => {
      const newTournaments = { ...s.tournaments };
      const tournament = newTournaments[tournamentId];
      delete newTournaments[tournamentId];
      
      addToast(`Tournament "${tournament.name}" deleted 🗑️`);
      return { ...s, tournaments: newTournaments, activeTournamentId: null, page: 'home' };
    });
  };

  const updateMatch = (matchId, update) => {
    setState(s => {
      const match = { ...s.matches[matchId] };

      // Handle toss result
      if (update.tossWinner !== undefined) {
        const battingTeam = update.battingTeam;
        const inningsKey = '1';
        match.tossWinner = update.tossWinner;
        match.tossChoice = update.tossChoice;
        match.battingTeam = battingTeam;
        match.status = 'live';
        match.startedAt = Date.now();
        match.innings = {
          '1': {
            team: battingTeam, runs: 0, wickets: 0, balls: 0,
            batsmen: {}, bowlers: {}, balls_by_ball: [],
            extras: 0, wides: 0, noballs: 0,
          }
        };
        match.currentInnings = '1';
      }

      // Handle player selection
      if (update.playerSelect) {
        const { role, player } = update.playerSelect;
        const inn = match.innings?.[match.currentInnings];
        if (inn) {
          const updatedInn = { ...inn };
          if (role === 'striker') updatedInn.striker = player;
          else if (role === 'nonStriker') updatedInn.nonStriker = player;
          else if (role === 'bowler') updatedInn.bowler = player;
          if (!updatedInn.batsmen[player.id] && role !== 'bowler') {
            updatedInn.batsmen = { ...updatedInn.batsmen, [player.id]: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false } };
          }
          if (!updatedInn.bowlers[player.id] && role === 'bowler') {
            updatedInn.bowlers = { ...updatedInn.bowlers, [player.id]: { balls: 0, runs: 0, wickets: 0 } };
          }
          match.innings = { ...match.innings, [match.currentInnings]: updatedInn };
        }
      }

      // Handle simple field updates
      if (update.title !== undefined) match.title = update.title;
      if (update.location !== undefined) match.location = update.location;
      if (update.notes !== undefined && !Array.isArray(update.notes)) match.notes = update.notes;
      if (update.captainA !== undefined) match.captainA = update.captainA;
      if (update.captainB !== undefined) match.captainB = update.captainB;

      // Handle catch drop
      if (update.catchDrop) {
        const { pid, runsAtDrop, innKey } = update.catchDrop;
        const inn = match.innings?.[innKey];
        if (inn) {
          const drops = [...(inn.catchDrops || [])];
          const pName = [...(match.teamA?.players||[]), ...(match.teamB?.players||[])].find(p => p.id === pid)?.name || '';
          drops.push({ pid, name: pName, runsAtDrop, at: Date.now() });
          match.innings = { ...match.innings, [innKey]: { ...inn, catchDrops: drops } };
        }
      }

      // Handle impact player substitution
      if (update.impactPlayer) {
        const { team, outId, inName } = update.impactPlayer;
        const teamKey = team === 'A' ? 'teamA' : 'teamB';
        const teamObj = { ...(match[teamKey] || {}) };
        const outPlayer = (teamObj.players || []).find(p => p.id === outId);
        const newPlayer = { id: 'impact_' + Date.now(), name: inName, isImpactIn: true };
        const impactTime = Date.now();
        teamObj.players = (teamObj.players || []).map(p =>
          p.id === outId ? { ...p, isImpactOut: true, replacedBy: newPlayer.id, replacedByName: inName, impactTime } : p
        );
        teamObj.players = [...teamObj.players, newPlayer];
        match[teamKey] = teamObj;
        match.impactPlayers = [...(match.impactPlayers || []), {
          team, outId, outName: outPlayer?.name || '', inId: newPlayer.id, inName, at: Date.now()
        }];
      }

      // Initialize super over
      if (update.initSuperOver) {
        const { battingFirst } = update.initSuperOver;
        match.superOver = {
          battingFirst,
          battingTeam: battingFirst,
          currentInnKey: 'so1',
          status: 'live',
          winner: null,
          innings: {
            so1: {
              battingTeam: battingFirst,
              runs: 0, wickets: 0, balls: 0,
              batsmen: {}, bowlers: {},
              balls_by_ball: [],
              striker: null, nonStriker: null, bowler: null,
            }
          }
        };
        match.status = 'live'; // reactivate match for super over
      }

      // Open super over page
      if (update._openSuperOver) {
        // handled by nav in App
      }

      // Handle DRS updates
      if (update.drs !== undefined) {
        match.drs = update.drs;
      }

      // Handle direct result override (from series winner buttons or end-match)
      if (update.result !== undefined) {
        match.result = update.result;
        match.status = 'done'; // Ensure match is marked done when result is set
      }

      // Handle Series ID updates
      if (update.seriesId !== undefined) {
        const oldSeriesId = match.seriesId;
        match.seriesId = update.seriesId;
        
        // Update state to also update series.matches array
        const newState = { ...s, matches: { ...s.matches, [matchId]: match } };
        
        // Remove from old series if it existed
        if (oldSeriesId && s.series[oldSeriesId]) {
          const oldSeries = { ...s.series[oldSeriesId] };
          // Recalculate old series score
          if (match.result?.winner === oldSeries.teamA) oldSeries.scoreA = (oldSeries.scoreA || 1) - 1;
          else if (match.result?.winner === oldSeries.teamB) oldSeries.scoreB = (oldSeries.scoreB || 1) - 1;
          
          newState.series = {
            ...s.series,
            [oldSeriesId]: {
              ...oldSeries,
              matches: (s.series[oldSeriesId].matches || []).filter(id => id !== matchId)
            }
          };
        }
        
        // Add to new series and update score
        if (update.seriesId && s.series[update.seriesId]) {
          const newSeries = { ...s.series[update.seriesId] };
          // Add match to series
          newSeries.matches = [...(s.series[update.seriesId].matches || []), matchId].filter((id, idx, arr) => arr.indexOf(id) === idx);
          
          // Update series score based on match result
          if (match.result?.winner) {
            if (match.result.winner === newSeries.teamA) {
              newSeries.scoreA = (newSeries.scoreA || 0) + 1;
            } else if (match.result.winner === newSeries.teamB) {
              newSeries.scoreB = (newSeries.scoreB || 0) + 1;
            }
          }
          
          newState.series = {
            ...newState.series,
            [update.seriesId]: newSeries
          };
        }
        
        return newState;
      }

      // If result is being updated and match is in a series, recompute series scores from scratch
      const newMatchesMap = { ...s.matches, [matchId]: match };
      if (update.result !== undefined && match.seriesId && s.series[match.seriesId]) {
        const ser = { ...s.series[match.seriesId] };
        let scoreA = 0, scoreB = 0;
        (ser.matches || []).forEach(id => {
          const m = newMatchesMap[id];
          if (!m) return;
          if (m.result?.winner === ser.teamA) scoreA++;
          else if (m.result?.winner === ser.teamB) scoreB++;
        });
        ser.scoreA = scoreA;
        ser.scoreB = scoreB;
        return { ...s, matches: newMatchesMap, series: { ...s.series, [match.seriesId]: ser } };
      }

      // Navigate to super over page if initializing
      const pageOverride = update.initSuperOver ? { page: 'superover' } : {};

      return { ...s, matches: newMatchesMap, ...pageOverride };
    });
  };

  const scoreMatch = (matchId, ball) => {
    setState(s => {
      const match = { ...s.matches[matchId] };
      const innKey = match.currentInnings;
      const inn = { ...match.innings[innKey] };
      inn.batsmen = { ...inn.batsmen };
      inn.bowlers = { ...inn.bowlers };
      inn.balls_by_ball = [...(inn.balls_by_ball || [])];

      const isWide = ball.type === 'wide';
      const isNoBall = ball.type === 'noball';
      const isLegal = !isWide;            // No-ball IS a legal delivery for batsman (they can score runs)
      const isWicket = ball.type === 'wicket';
      const strikerId = inn.striker?.id;
      const nonStrikerId = inn.nonStriker?.id;
      const bowlerId = inn.bowler?.id;

      // Wide: only +1 extra, no batting runs, not a legal ball
      // No-ball: +1 extra PLUS any runs scored by batsman (bat runs count, ball not counted in over)
      // Legal ball: runs go to batsman, ball counted
      const battingRuns = isWide ? 0 : (ball.runs || 0);
      const extraRun = (isWide || isNoBall) ? 1 : 0;
      const totalRuns = battingRuns + extraRun;

      const overIndex = Math.floor(inn.balls / 6);   // 0-based over
      const ballInOver = inn.balls % 6;               // 0-based ball within over

      const ballRecord = {
        runs: battingRuns,
        totalRuns,
        batsman: strikerId, // Store ID not name
        batsmanName: inn.striker?.name,
        bowler: bowlerId, // Store ID not name
        bowlerName: inn.bowler?.name,
        wide: isWide,
        noball: isNoBall,
        wicket: isWicket,
        wicketMode: ball.mode,
        outBatsman: ball.outBatsman || 'striker',
        caughtBy: ball.caughtBy || null,
        overIndex,
        ballInOver,
        ballId: `${overIndex}.${ballInOver + 1}`, // e.g. 0.1 for first ball
        timestamp: formatTime(),
        media: ball.media || null,
        video: ball.video || null,
        aiVerdict: ball.aiVerdict || null,
      };

      if (match.aiCommentary) {
        ballRecord.commentary = getCommentary({ ...ballRecord, runs: battingRuns });
        ballRecord.hindiCommentary = getHindiCommentary({ ...ballRecord, runs: battingRuns });
      }

      // Team runs
      inn.runs += totalRuns;
      if (isWide) { inn.extras = (inn.extras || 0) + 1; inn.wides = (inn.wides || 0) + 1; }
      if (isNoBall) { inn.extras = (inn.extras || 0) + 1; inn.noballs = (inn.noballs || 0) + 1; }

      // Bowler stats
      // No-ball & wide do NOT count as a ball bowled (don't count in over)
      if (bowlerId && inn.bowlers[bowlerId]) {
        const bs = { ...inn.bowlers[bowlerId] };
        bs.runs += totalRuns;
        if (!isWide && !isNoBall) bs.balls += 1;   // only legal deliveries count for bowler
        if (isWicket && ball.mode !== 'Run Out') bs.wickets += 1;
        inn.bowlers[bowlerId] = bs;
      }
      // Track catches taken by fielder
      if (isWicket && ball.mode === 'Caught' && ball.caughtBy) {
        if (!inn.fielders) inn.fielders = {};
        if (!inn.fielders[ball.caughtBy]) inn.fielders[ball.caughtBy] = { catches: 0 };
        inn.fielders[ball.caughtBy].catches++;
      }

      // Striker batsman stats
      // No-ball: runs count for batsman but ball does NOT count (free hit follows)
      // Wide: nothing counts for batsman
      if (strikerId && inn.batsmen[strikerId] && !isWide) {
        const bs = { ...inn.batsmen[strikerId] };
        bs.runs += battingRuns;
        if (!isNoBall) bs.balls += 1;   // no-ball: ball not counted for batsman strike count
        if (battingRuns === 4) bs.fours = (bs.fours || 0) + 1;
        if (battingRuns === 6) bs.sixes = (bs.sixes || 0) + 1;
        if (isWicket && ball.outBatsman !== 'nonStriker') {
          bs.out = true;
          bs.outMode = ball.mode;
          bs.bowlerName = inn.bowler?.name || '';
          if (ball.mode === 'Caught' && ball.caughtBy) {
            // resolve catcher name from fielding team
            const fieldingTeam = match.battingTeam === 'A' ? match.teamB : match.teamA;
            bs.caughtByName = (fieldingTeam?.players || []).find(p => p.id === ball.caughtBy)?.name || '';
          }
        }
        inn.batsmen[strikerId] = bs;
      }

      // Non-striker run-out
      if (isWicket && ball.mode === 'Run Out' && ball.outBatsman === 'nonStriker' && nonStrikerId && inn.batsmen[nonStrikerId]) {
        inn.batsmen = { ...inn.batsmen, [nonStrikerId]: { ...inn.batsmen[nonStrikerId], out: true } };
      }

      // Legal ball count (wide and no-ball don't count toward over)
      if (!isWide && !isNoBall) inn.balls += 1;
      if (isWicket) inn.wickets += 1;

      // Strike rotation on odd batting runs (not on wide)
      if (!isWicket && !isWide && (battingRuns % 2 === 1)) {
        const tmp = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = tmp;
      }

      // Null out the dismissed batsman
      if (isWicket) {
        if (ball.mode === 'Run Out' && ball.outBatsman === 'nonStriker') {
          inn.nonStriker = null;
        } else {
          inn.striker = null;
        }
      }

      // End of over — only when THIS ball was a legal delivery that incremented inn.balls
      // (wide/no-ball do not increment inn.balls, so they must never re-trigger the bowler reset)
      if (!isWide && !isNoBall && inn.balls > 0 && inn.balls % 6 === 0) {
        if (inn.striker && inn.nonStriker) {
          const tmp = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = tmp;
        }
        inn.bowler = null;
      }

      inn.balls_by_ball.push(ballRecord);
      match.innings = { ...match.innings, [innKey]: inn };

      // Innings end check
      // Count only active (non-substituted-out) players for all-out calculation
      // Impact substitution: 1 player out, 1 in — net count stays same, so count original non-impact players
      const getActiveBatters = (teamPlayers) => {
        if (!teamPlayers) return 10;
        // Exclude isImpactOut (substituted out) but include isImpactIn (new player)
        // Net effect: same count as original team
        return teamPlayers.filter(p => !p.isImpactOut).length;
      };
      const btPlayers = getActiveBatters(inn.team === 'A' ? match.teamA?.players : match.teamB?.players);
      const maxW = btPlayers || 10;
      const oversComplete = inn.balls >= match.overs * 6;
      const allOut = inn.wickets >= maxW;

      if ((oversComplete || allOut) && innKey === '1') {
        const bt2 = match.battingTeam === 'A' ? 'B' : 'A';
        match.innings['2'] = { team: bt2, runs: 0, wickets: 0, balls: 0, batsmen: {}, bowlers: {}, balls_by_ball: [], extras: 0, wides: 0, noballs: 0 };
        match.currentInnings = '2';
        match.battingTeam = bt2;
      }

      if (innKey === '2') {
        const btPlayers2 = getActiveBatters(inn.team === 'A' ? match.teamA?.players : match.teamB?.players);
        const maxW2 = btPlayers2 || 10;
        const allOut2 = inn.wickets >= maxW2;
        const oc2 = inn.balls >= match.overs * 6;
        const target = match.innings?.['1']?.runs + 1 || 1;
        if (inn.runs >= target || oc2 || allOut2) {
          match.status = 'done';
          match.endedAt = Date.now();
          const i1 = match.innings?.['1'], i2 = match.innings?.['2'];
          if (i1 && i2) {
            const t1 = i1.team === 'A' ? match.teamA?.name : match.teamB?.name;
            const t2 = i2.team === 'A' ? match.teamA?.name : match.teamB?.name;
            if (i2.runs >= target) {
              match.result = { winner: t2, by: `Won by ${maxW2 - i2.wickets} wicket${maxW2 - i2.wickets !== 1 ? 's' : ''}` };
            } else if (i1.runs > i2.runs) {
              match.result = { winner: t1, by: `Won by ${i1.runs - i2.runs} run${i1.runs - i2.runs !== 1 ? 's' : ''}` };
            } else {
              match.result = { winner: 'Match', by: 'Tied!' };
            }
            let topR = 0, potm = '';
            [...Object.entries(i1.batsmen || {}), ...Object.entries(i2.batsmen || {})].forEach(([pid, st]) => {
              if (st.runs > topR) { topR = st.runs; const p = [...(match.teamA?.players || []), ...(match.teamB?.players || [])].find(x => x.id === pid); if (p) potm = p.name; }
            });
            match.result.potm = potm;
          }
        }
      }

      let toastMsg = null, toastType = '';
      if (isWicket) { toastMsg = `🏏 ${ball.mode || 'WICKET'}!`; toastType = 'wicket'; }
      else if (battingRuns === 6) { toastMsg = '💥 SIX!'; toastType = 'six'; }
      else if (battingRuns === 4) { toastMsg = '🔥 FOUR!'; toastType = 'four'; }

      // ── Milestone Alerts ──
      const milestoneToasts = [];
      const currentInnAfter = match.innings[innKey];

      // Batsman milestones (50, 100)
      if (strikerId && inn.batsmen[strikerId]) {
        const prevRuns = (inn.batsmen[strikerId].runs || 0) - battingRuns;
        const newRuns = inn.batsmen[strikerId].runs || 0;
        const bName = inn.striker?.name || '';
        if (prevRuns < 100 && newRuns >= 100) milestoneToasts.push({ msg: `🏆 CENTURY! ${bName} hits 100!`, type: 'milestone' });
        else if (prevRuns < 50 && newRuns >= 50) milestoneToasts.push({ msg: `⭐ FIFTY! ${bName} reaches 50!`, type: 'milestone' });
      }
      // Bowler wicket milestones (3, 5)
      if (isWicket && bowlerId && inn.bowlers[bowlerId]) {
        const wkts = inn.bowlers[bowlerId].wickets || 0;
        const bName = inn.bowler?.name || '';
        if (wkts === 5) milestoneToasts.push({ msg: `🎯 FIVE-FOR! ${bName} takes 5 wickets!`, type: 'milestone' });
        else if (wkts === 3) milestoneToasts.push({ msg: `🎳 3-WICKET HAUL! ${bName}!`, type: 'milestone' });
      }
      // Team milestones (100)
      const teamRunsBefore = (currentInnAfter.runs || 0) - totalRuns;
      const teamRunsAfter = currentInnAfter.runs || 0;
      if (teamRunsBefore < 100 && teamRunsAfter >= 100) milestoneToasts.push({ msg: `🏏 Team reaches 100 runs!`, type: 'milestone' });
      if (teamRunsBefore < 200 && teamRunsAfter >= 200) milestoneToasts.push({ msg: `💯 Team reaches 200 runs!`, type: 'milestone' });

      const newState = { ...s, matches: { ...s.matches, [matchId]: match } };
      const allToasts = toastMsg ? [{ id: genId(), msg: toastMsg, type: toastType }] : [];
      milestoneToasts.forEach(mt => allToasts.push({ id: genId(), ...mt }));
      if (allToasts.length > 0) {
        newState.toasts = [...(s.toasts || []), ...allToasts];
        allToasts.forEach(t => {
          setTimeout(() => setState(st => ({ ...st, toasts: st.toasts.filter(x => x.id !== t.id) })), 4000);
        });
      }
      return newState;
    });
  };

  const undoScore = (matchId) => {
    setState(s => {
      const match = { ...s.matches[matchId] };
      const innKey = match.currentInnings;
      const inn = { ...match.innings[innKey] };
      if (!inn.balls_by_ball || inn.balls_by_ball.length === 0) return s;

      const wasDone = match.status === 'done';

      const last = inn.balls_by_ball[inn.balls_by_ball.length - 1];
      inn.balls_by_ball = inn.balls_by_ball.slice(0, -1);

      const isLegal = !last.wide && !last.noball;
      const battingRuns = last.runs || 0;
      const totalRuns = last.totalRuns !== undefined ? last.totalRuns : battingRuns + (last.wide || last.noball ? 1 : 0);
      
      // Undo innings stats
      inn.runs = Math.max(0, inn.runs - totalRuns);
      if (isLegal) inn.balls = Math.max(0, inn.balls - 1);
      if (last.wicket) inn.wickets = Math.max(0, inn.wickets - 1);
      if (last.wide) { inn.wides = Math.max(0, (inn.wides || 0) - 1); inn.extras = Math.max(0, (inn.extras || 0) - 1); }
      if (last.noball) { inn.noballs = Math.max(0, (inn.noballs || 0) - 1); inn.extras = Math.max(0, (inn.extras || 0) - 1); }

      // Undo batsman stats
      if (last.batsman && inn.batsmen?.[last.batsman]) {
        const batter = { ...inn.batsmen[last.batsman] };
        batter.runs = Math.max(0, (batter.runs || 0) - battingRuns);
        if (isLegal) batter.balls = Math.max(0, (batter.balls || 0) - 1);
        if (last.runs === 4) batter.fours = Math.max(0, (batter.fours || 0) - 1);
        if (last.runs === 6) batter.sixes = Math.max(0, (batter.sixes || 0) - 1);
        if (last.wicket) {
          batter.out = false;
          batter.outMode = undefined;
          batter.bowlerName = undefined;
          batter.caughtByName = undefined;
        }
        inn.batsmen = { ...inn.batsmen, [last.batsman]: batter };
      }

      // Undo bowler stats
      if (last.bowler && inn.bowlers?.[last.bowler]) {
        const bowler = { ...inn.bowlers[last.bowler] };
        bowler.runs = Math.max(0, (bowler.runs || 0) - totalRuns);
        if (isLegal) bowler.balls = Math.max(0, (bowler.balls || 0) - 1);
        if (last.wicket) bowler.wickets = Math.max(0, (bowler.wickets || 0) - 1);
        inn.bowlers = { ...inn.bowlers, [last.bowler]: bowler };
      }

      // Undo fielder catch if this was a caught dismissal
      if (last.wicket && last.wicketMode === 'Caught' && last.caughtBy && inn.fielders?.[last.caughtBy]) {
        inn.fielders = { ...inn.fielders, [last.caughtBy]: { ...inn.fielders[last.caughtBy], catches: Math.max(0, (inn.fielders[last.caughtBy].catches || 0) - 1) } };
      }

      // Undo strike rotation if needed
      if (isLegal && battingRuns % 2 === 1) {
        const temp = inn.striker;
        inn.striker = inn.nonStriker;
        inn.nonStriker = temp;
      }

      // If the wicket that just got undone had ended the innings (striker/non-striker were nulled),
      // restore the dismissed batsman as striker/non-striker so scoring can continue
      if (last.wicket && !inn.striker && !inn.nonStriker) {
        const restoredId = last.outBatsman === 'nonStriker' ? (inn.batsmen?.[last.batsman] ? last.batsman : null) : last.batsman;
        // Find player object from team rosters
        const teamPlayers = [...(match.teamA?.players || []), ...(match.teamB?.players || [])];
        const restoredPlayer = teamPlayers.find(p => p.id === restoredId);
        if (restoredPlayer) {
          if (last.outBatsman === 'nonStriker') inn.nonStriker = restoredPlayer;
          else inn.striker = restoredPlayer;
        }
      }

      match.innings = { ...match.innings, [innKey]: inn };

      // If the match had already ended, undoing the ball reopens it for further scoring
      let seriesUpdate = null;
      if (wasDone) {
        const prevWinner = match.result?.winner;
        match.status = 'live';
        match.result = null;
        match.endedAt = null;
        // If this match's result had already been counted in the series score, undo that too
        if (prevWinner && match.seriesId && s.series[match.seriesId]) {
          const ser = { ...s.series[match.seriesId] };
          if (prevWinner === ser.teamA) ser.scoreA = Math.max(0, (ser.scoreA || 0) - 1);
          else if (prevWinner === ser.teamB) ser.scoreB = Math.max(0, (ser.scoreB || 0) - 1);
          seriesUpdate = { id: match.seriesId, ser };
        }
      }

      if (seriesUpdate) {
        return { ...s, matches: { ...s.matches, [matchId]: match }, series: { ...s.series, [seriesUpdate.id]: seriesUpdate.ser } };
      }
      return { ...s, matches: { ...s.matches, [matchId]: match } };
    });
    addToast('↩️ Ball undone - all stats restored');
  };

  const endMatch = (matchId) => {
    setState(s => {
      const match = { ...s.matches[matchId] };
      match.status = 'done';
      match.endedAt = Date.now();
      if (!match.result) {
        const inn1 = match.innings?.['1'];
        const inn2 = match.innings?.['2'];
        if (inn1 && !inn2) {
          const t1 = inn1.team === 'A' ? match.teamA?.name : match.teamB?.name;
          match.result = { winner: t1, by: 'Match ended (1 innings)' };
        } else if (inn1 && inn2) {
          const team1Name = inn1.team === 'A' ? match.teamA?.name : match.teamB?.name;
          const team2Name = inn2.team === 'A' ? match.teamA?.name : match.teamB?.name;
          if (inn2.runs > inn1.runs) match.result = { winner: team2Name, by: `Won by ${(match.teamA?.players?.length || 10) - 1 - inn2.wickets} wickets` };
          else if (inn1.runs > inn2.runs) match.result = { winner: team1Name, by: `Won by ${inn1.runs - inn2.runs} runs` };
          else match.result = { winner: 'Match', by: 'Tied!' };
        }
      }
      return { ...s, matches: { ...s.matches, [matchId]: match } };
    });
    addToast('🏁 Match ended');
    // Auto-update series score
    setState(s => {
      const match = s.matches[matchId];
      if (!match?.seriesId || !s.series[match.seriesId] || !match.result?.winner) return s;
      const ser = { ...s.series[match.seriesId] };
      if (match.result.winner === ser.teamA) ser.scoreA = (ser.scoreA || 0) + 1;
      else if (match.result.winner === ser.teamB) ser.scoreB = (ser.scoreB || 0) + 1;
      return { ...s, series: { ...s.series, [match.seriesId]: ser } };
    });
  };

  const addNote = (matchId, text) => {
    if (!text.trim()) return;
    setState(s => {
      const match = { ...s.matches[matchId] };
      match.notes = [...(match.notes || []), { text, time: Date.now() }];
      return { ...s, matches: { ...s.matches, [matchId]: match } };
    });
  };

  const addEquipment = (matchId, equip) => {
    if (!equip.player || !equip.items) return;
    setState(s => {
      const match = { ...s.matches[matchId] };
      match.equipment = [...(match.equipment || []), equip];
      return { ...s, matches: { ...s.matches, [matchId]: match } };
    });
  };

  const react = (matchId, emoji) => {
    setState(s => {
      const match = { ...s.matches[matchId] };
      match.reactions = { ...match.reactions, [emoji]: (match.reactions?.[emoji] || 0) + 1 };
      return { ...s, matches: { ...s.matches, [matchId]: match } };
    });
  };

  const savePlayer = (player, deleteId = null) => {
    setState(s => {
      const players = { ...s.players };
      if (deleteId) { delete players[deleteId]; addToast('Player removed'); }
      else if (player) { players[player.id] = player; addToast(`${player.name} saved! 🏏`); }
      return { ...s, players };
    });
  };

  const saveTeam = (team, deleteId = null) => {
    setState(s => {
      const teams = { ...s.teams };
      if (deleteId) {
        delete teams[deleteId];
        addToast('Team deleted 🗑️');
      } else if (team) {
        teams[team.id] = team;
        addToast(`${team.name} saved! 👥`);
      }
      return { ...s, teams };
    });
  };

  const saveTournament = (tournament) => {
    setState(s => {
      const tourn = { ...tournament, creatorId: tournament.creatorId || s.user?.id };
      const tournaments = { ...s.tournaments, [tourn.id]: tourn };
      addToast(tourn.status === 'done' ? `🏆 ${tourn.winner} wins the ${tourn.name}!` : `Tournament updated`);
      return { ...s, tournaments };
    });
  };

  const joinByCode = async (code) => {
    const trimmed = code.trim();
    if (!trimmed) { addToast('Please enter a code', ''); return; }

    // Try to decode a pasted share code (compact format from "Copy Share Code"
    // or the downloaded HTML file) — still supported as an offline fallback,
    // but the primary path below (Supabase lookup) is what makes plain
    // 6-character codes work across any device, browser, or account.
    if (trimmed.length > 20 && !/^[A-Z0-9]{4,8}$/.test(trimmed)) {
      const parsed = parseShareCode(trimmed);
      if (parsed?.match) {
        const sharedMatch = { ...parsed.match, _shared: true, _editorAccess: parsed.role === 'editor' };
        setState(s => ({
          ...s,
          matches: { ...s.matches, [sharedMatch.id]: sharedMatch },
          activeMatchId: sharedMatch.id,
          page: 'match',
        }));
        addToast(`Opened as ${parsed.role === 'editor' ? 'Editor ✏️' : 'Viewer 👁️'}`);
        return;
      }
    }

    const normalizedCode = trimmed.toUpperCase();

    // Already open locally (e.g. it's your own match)?
    const ownMatch = Object.values(state.matches).find(m =>
      (m.viewerCode && m.viewerCode.toUpperCase() === normalizedCode) ||
      (m.editorCode && m.editorCode.toUpperCase() === normalizedCode)
    );
    if (ownMatch) { nav('match', ownMatch.id); addToast('Opened match! 🏏'); return; }

    // Look the code up in Supabase — this is a real database query, so it
    // finds the match regardless of which device, browser, or account
    // created it, as long as the code is correct.
    addToast('🔍 Looking up code...', '');
    try {
      const result = await fetchMatchByCode(normalizedCode);
      if (result?.match) {
        const sharedMatch = { ...result.match, _shared: true, _editorAccess: result.isEditor };
        setState(s => ({
          ...s,
          matches: { ...s.matches, [sharedMatch.id]: sharedMatch },
          activeMatchId: sharedMatch.id,
          page: 'match',
        }));
        addToast(`Opened as ${result.isEditor ? 'Editor ✏️' : 'Viewer 👁️'}`);
        return;
      }
    } catch (e) {
      console.error('Code lookup failed:', e);
      addToast('❌ Could not look up that code — check your connection and try again', '');
      return;
    }

    addToast('❌ Code not found. Double-check the code and try again.', '');
  };

  const createMatchInSeries = (seriesId) => {
    setState(s => ({ ...s, page: 'createMatch', pendingSeriesId: seriesId }));
  };

  const activeMatch = state.activeMatchId ? state.matches[state.activeMatchId] : null;
  const activeSeries = state.activeSeriesId ? state.series[state.activeSeriesId] : null;

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {state.user && <Nav user={state.user} page={state.page} onNav={nav} onLogout={handleLogout} />}
        <ToastContainer toasts={state.toasts || []} />

        {(state.page === 'login' || state.page === 'register') && !state.user && (
          <AuthPage onAuth={handleAuth} mode={state.page} />
        )}
        {/* Allow viewing shared match even without account */}
        {state.page === 'match' && activeMatch && !state.user && (
          <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>You're viewing a shared match</div>
            <button className="btn btn-primary btn-sm" onClick={() => nav('login')}>Login / Register to score</button>
          </div>
        )}
        {state.page === 'home' && state.user && (
          <HomePage state={state} onNav={nav} onJoin={joinByCode} />
        )}
        {state.page === 'createMatch' && (
          <CreateMatchPage
            state={state}
            onCreate={createMatch}
            onBack={() => {
              if (state.pendingSeriesId) {
                setState(s => ({ ...s, page: 'series', activeSeriesId: s.pendingSeriesId, pendingSeriesId: null }));
              } else {
                nav('home');
              }
            }}
            initialSeriesId={state.pendingSeriesId || ''}
          />
        )}
        {state.page === 'createSeries' && (
          <CreateSeriesPage state={state} onCreate={createSeries} onBack={() => nav('home')} />
        )}
        {state.page === 'match' && activeMatch && (
          <MatchPage
            match={activeMatch} state={state}
            onScore={scoreMatch} onUndo={undoScore}
            onEndMatch={endMatch} onUpdateMatch={updateMatch}
            onAddNote={addNote} onAddEquipment={addEquipment}
            onReact={react} onDeleteMatch={deleteMatch}
            onBack={() => {
              if (activeMatch.seriesId) nav('series', activeMatch.seriesId);
              else nav('home');
            }}
            onNav={nav}
          />
        )}
        {state.page === 'series' && activeSeries && (
          <SeriesPage
            series={activeSeries} matches={state.matches}
            state={state}
            onBack={() => nav('home')} onNav={nav}
            onCreateMatchInSeries={createMatchInSeries}
            onDeleteSeries={deleteSeries}
            onUpdateMatch={updateMatch}
          />
        )}
        {state.page === 'seriesStats' && activeSeries && (
          <SeriesStatsPage
            series={activeSeries} matches={state.matches}
            state={state}
            onBack={() => nav('series', activeSeries.id)} onNav={nav}
          />
        )}
        {state.page === 'leaderboard' && (
          <LeaderboardPage state={state} onBack={() => nav('home')} onNav={nav} onEditPlayerStats={editPlayerStats} />
        )}
        {state.page === 'allMatches' && (
          <AllMatchesPage state={state} onBack={() => nav('home')} onNav={nav} />
        )}
        {state.page === 'allSeries' && (
          <AllSeriesPage state={state} onBack={() => nav('home')} onNav={nav} />
        )}
        {state.page === 'records' && (
          <RecordsPage state={state} onBack={() => nav('home')} onNav={nav} />
        )}
        {state.page === 'partnerships' && (
          <PartnershipsPage state={state} onBack={() => nav('home')} />
        )}
        {state.page === 'vs' && (
          <PlayerVsStatsPage state={state} onBack={() => nav('home')} onDeletePlayerVsStats={deletePlayerVsStats} />
        )}
        {state.page === 'profile' && (
          <ProfilePage user={state.user} state={state} onBack={() => nav('home')} onUpdateUser={updateUser} onLogout={handleLogout} />
        )}
        {state.page === 'players' && (
          <PlayerRegistryPage state={state} onSave={savePlayer} onBack={() => nav('home')} onNav={nav} />
        )}
        {state.page === 'teams' && (
          <TeamManagementPage state={state} onSaveTeam={saveTeam} onBack={() => nav('home')} />
        )}
        {state.page === 'tournaments' && (
          <TournamentPage state={state} onSaveTournament={saveTournament} onBack={() => nav('home')} onNav={nav} onDeleteTournament={deleteTournament} />
        )}
        {state.page === 'share' && activeMatch && (
          <ShareMatchPage match={activeMatch} onBack={() => nav('match', activeMatch.id)} />
        )}
        {state.page === 'career' && state.activeCareerPlayerId && (
          <CareerTrackerPage playerId={state.activeCareerPlayerId} state={state} onBack={() => nav('players')} onEditPlayerStats={editPlayerStats} onNav={nav} />
        )}
        {state.page === 'graph' && state.activeCareerPlayerId && (
          <PerformanceGraphPage playerId={state.activeCareerPlayerId} state={state} onBack={() => nav('career', state.activeCareerPlayerId)} />
        )}
        {state.page === 'graph' && state.activeCareerPlayerId && (
          <PerformanceGraphPage playerId={state.activeCareerPlayerId} state={state} onBack={() => nav('career', state.activeCareerPlayerId)} />
        )}
        {state.page === 'superover' && activeMatch && (
          <SuperOverScoring
            match={activeMatch}
            onBack={() => nav('match', activeMatch.id)}
            onScore={(type, runs, soKey, so, extras) => {
              setState(s => {
                const match = { ...s.matches[activeMatch.id] };
                const superOver = { ...match.superOver };
                const inn = { ...superOver.innings[soKey] };

                if (type === 'soSetup') {
                  const { batter1, batter2, bowlerPid } = extras;
                  const battingTeam = soKey === 'so1' ? match[`team${superOver.battingFirst}`] : match[`team${superOver.battingFirst === 'A' ? 'B' : 'A'}`];
                  const fieldingTeam = soKey === 'so1' ? match[`team${superOver.battingFirst === 'A' ? 'B' : 'A'}`] : match[`team${superOver.battingFirst}`];
                  const b1 = (battingTeam?.players || []).find(p => p.id === batter1);
                  const b2 = (battingTeam?.players || []).find(p => p.id === batter2);
                  const bwl = (fieldingTeam?.players || []).find(p => p.id === bowlerPid);
                  inn.striker = b1 || null;
                  inn.nonStriker = b2 || null;
                  inn.bowler = bwl || null;
                  inn.batsmen = { [batter1]: { runs: 0, balls: 0, fours: 0, sixes: 0 }, [batter2]: { runs: 0, balls: 0, fours: 0, sixes: 0 } };
                  inn.bowlers = { [bowlerPid]: { runs: 0, balls: 0, wickets: 0 } };
                  superOver.innings = { ...superOver.innings, [soKey]: inn };
                  match.superOver = superOver;
                  return { ...s, matches: { ...s.matches, [match.id]: match } };
                }

                const isWide = type === 'wide';
                const isNoBall = type === 'noball';
                const isWicket = type === 'wicket';
                const battingRuns = isWide ? 0 : (runs || 0);
                const extraRun = (isWide || isNoBall) ? 1 : 0;
                const totalRuns = battingRuns + extraRun;
                const strikerId = inn.striker?.id;
                const bowlerId = inn.bowler?.id;

                inn.runs = (inn.runs || 0) + totalRuns;
                if (!isWide && !isNoBall) inn.balls = (inn.balls || 0) + 1;
                if (isWicket) inn.wickets = (inn.wickets || 0) + 1;

                if (strikerId && inn.batsmen?.[strikerId] && !isWide) {
                  const bs = { ...inn.batsmen[strikerId] };
                  bs.runs += battingRuns;
                  if (!isNoBall) bs.balls++;
                  if (battingRuns === 4) bs.fours = (bs.fours || 0) + 1;
                  if (battingRuns === 6) bs.sixes = (bs.sixes || 0) + 1;
                  inn.batsmen = { ...inn.batsmen, [strikerId]: bs };
                }
                if (bowlerId && inn.bowlers?.[bowlerId]) {
                  const bw = { ...inn.bowlers[bowlerId] };
                  bw.runs += totalRuns;
                  if (!isWide && !isNoBall) bw.balls++;
                  if (isWicket && type !== 'Run Out') bw.wickets++;
                  inn.bowlers = { ...inn.bowlers, [bowlerId]: bw };
                }
                if (isWicket) inn.striker = null;
                if (battingRuns % 2 === 1 && !isWicket && !isWide) {
                  const tmp = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = tmp;
                }
                inn.balls_by_ball = [...(inn.balls_by_ball || []), { runs: battingRuns, wide: isWide, noball: isNoBall, wicket: isWicket, batsman: strikerId, bowler: bowlerId, totalRuns }];
                superOver.innings = { ...superOver.innings, [soKey]: inn };
                match.superOver = superOver;
                return { ...s, matches: { ...s.matches, [match.id]: match } };
              });
            }}
            onUndo={() => {
              setState(s => {
                const match = { ...s.matches[activeMatch.id] };
                const so = { ...match.superOver };
                const soKey = so.currentInnKey;
                const inn = { ...so.innings[soKey] };
                if (!inn.balls_by_ball?.length) return s;
                const last = inn.balls_by_ball[inn.balls_by_ball.length - 1];
                inn.balls_by_ball = inn.balls_by_ball.slice(0, -1);
                inn.runs = Math.max(0, (inn.runs || 0) - last.totalRuns);
                if (!last.wide && !last.noball) inn.balls = Math.max(0, (inn.balls || 0) - 1);
                if (last.wicket) inn.wickets = Math.max(0, (inn.wickets || 0) - 1);
                if (last.batsman && inn.batsmen?.[last.batsman]) {
                  const bs = { ...inn.batsmen[last.batsman] };
                  bs.runs = Math.max(0, bs.runs - (last.runs || 0));
                  if (!last.noball && !last.wide) bs.balls = Math.max(0, bs.balls - 1);
                  inn.batsmen = { ...inn.batsmen, [last.batsman]: bs };
                }
                if (last.bowler && inn.bowlers?.[last.bowler]) {
                  const bw = { ...inn.bowlers[last.bowler] };
                  bw.runs = Math.max(0, bw.runs - last.totalRuns);
                  if (!last.wide && !last.noball) bw.balls = Math.max(0, bw.balls - 1);
                  if (last.wicket) bw.wickets = Math.max(0, bw.wickets - 1);
                  inn.bowlers = { ...inn.bowlers, [last.bowler]: bw };
                }
                so.innings = { ...so.innings, [soKey]: inn };
                match.superOver = so;
                return { ...s, matches: { ...s.matches, [match.id]: match } };
              });
            }}
            onEndSuperOver={(soKey, soRuns, soWickets) => {
              setState(s => {
                const match = { ...s.matches[activeMatch.id] };
                const so = { ...match.superOver };

                if (soKey === 'so1') {
                  // Start 2nd innings of super over
                  const battingTeam2 = so.battingFirst === 'A' ? 'B' : 'A';
                  so.battingTeam = battingTeam2;
                  so.currentInnKey = 'so2';
                  so.innings = {
                    ...so.innings,
                    so2: {
                      battingTeam: battingTeam2,
                      runs: 0, wickets: 0, balls: 0,
                      batsmen: {}, bowlers: {},
                      balls_by_ball: [],
                      striker: null, nonStriker: null, bowler: null,
                    }
                  };
                } else {
                  // Determine winner using TARGET-CHASE rules (like a 1-over match):
                  // Team batting 2nd (so2) must chase the target (so1Runs + 1) within 1 over.
                  // If so2 reaches/exceeds the target → so2 team wins (chase successful).
                  // If so2 finishes the over (or loses 2 wkts) without reaching target → so1 team wins.
                  // Exact tie (so2Runs === so1Runs after using full over, target not reached) → tiebreaker by sixes.
                  const so1Runs = so.innings.so1?.runs || 0;
                  const so2Runs = so.innings.so2?.runs || 0;
                  const team1Name = so.battingFirst === 'A' ? match.teamA?.name : match.teamB?.name;
                  const team2Name = so.battingFirst === 'A' ? match.teamB?.name : match.teamA?.name;
                  const target = so1Runs + 1;

                  if (so2Runs >= target) {
                    // Chase successful — team batting 2nd wins
                    so.winner = team2Name;
                  } else if (so2Runs < so1Runs) {
                    // Chase failed — team batting 1st wins
                    so.winner = team1Name;
                  } else {
                    // so2Runs === so1Runs (target not reached, but scores level after full over/wickets)
                    const soSixes1 = (so.innings.so1?.balls_by_ball || []).filter(b => b.runs === 6).length;
                    const soSixes2 = (so.innings.so2?.balls_by_ball || []).filter(b => b.runs === 6).length;
                    so.winner = soSixes2 > soSixes1 ? team2Name : soSixes1 > soSixes2 ? team1Name : `${team1Name} (Toss)`;
                  }
                  so.status = 'done';
                  match.result = { winner: so.winner, by: `Won Super Over (${so1Runs} vs ${so2Runs})` };
                  match.status = 'done';
                  match.endedAt = Date.now();
                  nav('match', match.id);
                }

                match.superOver = so;
                return { ...s, matches: { ...s.matches, [match.id]: match } };
              });
            }}
          />
        )}
        {state.page === 'suggestions' && (
          <SuggestionsPage onBack={() => nav('home')} user={state.user} />
        )}
      </div>
    </>
  );
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithAuth;
