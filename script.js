// ══════════════════════════════════════════════════════
        // FULL AUDIO ENGINE — Background Music + SFX
        // Sab kuch Web Audio API se — koi external file nahi
        // ══════════════════════════════════════════════════════
        let AC, masterGain, reverbNode, musicGain, sfxGain;
        let bgmNodes = [];
        let bgmRunning = false;
        let currentBGM = null;
        let musicVolume = 0.55, sfxVolume = 0.7;

        function initAudio() {
            try {
                AC = new (window.AudioContext || window.webkitAudioContext)();
                masterGain = AC.createGain(); masterGain.gain.value = 1.0;
                musicGain = AC.createGain(); musicGain.gain.value = musicVolume;
                sfxGain = AC.createGain(); sfxGain.gain.value = sfxVolume;

                // Convolution reverb via impulse
                reverbNode = AC.createConvolver();
                const len = AC.sampleRate * 2.5;
                const ir = AC.createBuffer(2, len, AC.sampleRate);
                for (let ch = 0; ch < 2; ch++) {
                    const d = ir.getChannelData(ch);
                    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
                }
                reverbNode.buffer = ir;

                const revGain = AC.createGain(); revGain.gain.value = 0.28;
                musicGain.connect(reverbNode); reverbNode.connect(revGain); revGain.connect(masterGain);
                musicGain.connect(masterGain);
                sfxGain.connect(masterGain);
                masterGain.connect(AC.destination);

                // Audio controls UI
                buildAudioUI();
            } catch (e) { console.warn('Audio init failed', e); }
        }

        /* ── UI controls ── */
        // ── Real music player (loaded from local file) ──
        let realAudio = null;
        let realMusicLoaded = false;

        function buildAudioUI() {
            // ── Bottom-right control bar ──
            const bar = document.createElement('div');
            bar.id = 'audio-ctrl';
            bar.style.cssText = `position:fixed;bottom:14px;right:16px;z-index:400;display:flex;align-items:center;gap:10px;background:rgba(4,8,16,0.94);border:1px solid #1a2838;padding:8px 14px;border-radius:2px;font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;color:#607888;box-shadow:0 0 20px rgba(0,0,0,0.5)`;
            bar.innerHTML = `
    <span id='music-icon' style='color:#c8901a;font-size:13px'>♪</span>
    <span id='music-status' style='color:#3a5060;font-size:9px;max-width:110px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis'>procedural music</span>
    <input id='vol-music' type='range' min='0' max='100' value='55' style='width:56px;accent-color:#c8901a;cursor:pointer' title='Music Volume'/>
    <span style='color:#1e2e3a'>│</span>
    <span style='color:#3a5060;font-size:9px'>SFX</span>
    <input id='vol-sfx' type='range' min='0' max='100' value='70' style='width:50px;accent-color:#50d890;cursor:pointer' title='SFX Volume'/>
    <button id='btn-load-music' onclick='triggerMusicLoad()' title='Load MP3 music file' style='font-family:Cinzel,serif;font-size:9px;letter-spacing:1px;padding:3px 9px;background:transparent;border:1px solid #253545;color:#4a8090;cursor:pointer;border-radius:1px;transition:all 0.2s'>📂 LOAD</button>
    <button id='btn-mute' onclick='toggleMute()' style='font-family:Cinzel,serif;font-size:9px;letter-spacing:1px;padding:3px 9px;background:transparent;border:1px solid #1a2838;color:#607888;cursor:pointer;border-radius:1px;transition:all 0.2s'>MUTE</button>
    <input id='music-file-inp' type='file' accept='audio/*' style='display:none'>
  `;
            document.body.appendChild(bar);

            // ── Drag-and-drop zone (full page) ──
            document.addEventListener('dragover', e => { e.preventDefault(); showDropZone(); });
            document.addEventListener('dragleave', e => { if (!e.relatedTarget) hideDropZone(); });
            document.addEventListener('drop', e => { e.preventDefault(); hideDropZone(); loadMusicFile(e.dataTransfer.files[0]); });

            // ── Drop zone overlay ──
            const dz = document.createElement('div');
            dz.id = 'drop-zone';
            dz.style.cssText = `display:none;position:fixed;inset:0;z-index:800;background:rgba(4,8,16,0.88);backdrop-filter:blur(6px);align-items:center;justify-content:center;flex-direction:column;border:2px dashed #c8901a;font-family:'Cinzel',serif;color:#f5d060;text-align:center;gap:16px`;
            dz.innerHTML = `<div style='font-size:48px'>🎵</div><div style='font-size:18px;letter-spacing:3px'>DROP MUSIC FILE HERE</div><div style='font-size:11px;color:#c8901a;letter-spacing:2px;opacity:0.7'>MP3 • WAV • OGG</div>`;
            document.body.appendChild(dz);

            // ── Pixabay instruction banner (shown until music loaded) ──
            const banner = document.createElement('div');
            banner.id = 'music-banner';
            banner.style.cssText = `position:fixed;top:66px;left:50%;transform:translateX(-50%);z-index:400;background:rgba(4,8,16,0.96);border:1px solid #c8901a;padding:12px 20px;font-family:'Cinzel',serif;font-size:11px;color:#c8901a;letter-spacing:1px;text-align:center;max-width:480px;width:90%;border-radius:2px;box-shadow:0 0 30px rgba(200,144,26,0.15);animation:bannerIn 0.6s ease`;
            banner.innerHTML = `
    <div style='font-size:13px;margin-bottom:6px;color:#f5d060'>♪ CINEMATIC MUSIC ADD KARO</div>
    <div style='font-size:10px;color:#7090a8;line-height:1.7;margin-bottom:10px'>
      1. <a href='https://pixabay.com/music/adventure-adventure-cinematic-music-469464/' target='_blank' style='color:#4a9fd8;text-decoration:none'>Yahan click karo</a> — Pixabay se FREE MP3 download karo<br>
      2. Downloaded file ko <strong style='color:#f5d060'>is game window mein drag & drop karo</strong><br>
      3. Ya neeche 📂 LOAD button se file choose karo
    </div>
    <div style='display:flex;gap:8px;justify-content:center'>
      <button onclick='triggerMusicLoad()' style='font-family:Cinzel,serif;font-size:10px;letter-spacing:1px;padding:6px 16px;background:rgba(200,144,26,0.12);border:1px solid #c8901a;color:#f5d060;cursor:pointer;border-radius:1px'>📂 FILE CHOOSE KARO</button>
      <button onclick='document.getElementById("music-banner").remove()' style='font-family:Cinzel,serif;font-size:10px;letter-spacing:1px;padding:6px 12px;background:transparent;border:1px solid #253545;color:#3a5060;cursor:pointer;border-radius:1px'>✕ BAAD MEIN</button>
    </div>
  `;
            document.body.appendChild(banner);
            setTimeout(() => { if (document.getElementById('music-banner')) document.getElementById('music-banner').style.opacity = '0.85'; }, 5000);

            // Volume sliders
            document.getElementById('vol-music').addEventListener('input', e => {
                musicVolume = e.target.value / 100;
                if (musicGain) musicGain.gain.setTargetAtTime(musicVolume, AC.currentTime, 0.1);
                if (realAudio) realAudio.volume = musicVolume;
            });
            document.getElementById('vol-sfx').addEventListener('input', e => {
                sfxVolume = e.target.value / 100;
                if (sfxGain) sfxGain.gain.setTargetAtTime(sfxVolume, AC.currentTime, 0.1);
            });

            // File input
            document.getElementById('music-file-inp').addEventListener('change', e => {
                loadMusicFile(e.target.files[0]);
            });
        }

        function showDropZone() { const d = document.getElementById('drop-zone'); if (d) { d.style.display = 'flex'; } }
        function hideDropZone() { const d = document.getElementById('drop-zone'); if (d) { d.style.display = 'none'; } }

        function triggerMusicLoad() { document.getElementById('music-file-inp').click(); }

        function loadMusicFile(file) {
            if (!file || !file.type.startsWith('audio/')) return;
            const url = URL.createObjectURL(file);

            // Stop procedural music completely
            stopBGM(0.5);

            // Create / configure HTML5 Audio element
            if (realAudio) { realAudio.pause(); URL.revokeObjectURL(realAudio.src); }
            realAudio = new Audio(url);
            realAudio.loop = true;
            realAudio.volume = musicVolume;

            // Connect through Web Audio for seamless gain control with SFX
            try {
                const src = AC.createMediaElementSource(realAudio);
                src.connect(musicGain);
            } catch (e) { /* already connected or AC not ready */ }

            realAudio.play().then(() => {
                realMusicLoaded = true;
                // Update UI
                const name = file.name.replace(/\.[^.]+$/, '').substring(0, 22);
                const el = document.getElementById('music-status');
                if (el) { el.textContent = '♪ ' + name; el.style.color = '#c8901a'; }
                const icon = document.getElementById('music-icon');
                if (icon) { icon.style.color = '#f5d060'; icon.style.textShadow = '0 0 10px rgba(240,200,80,0.6)'; }
                const btn = document.getElementById('btn-load-music');
                if (btn) { btn.style.color = '#50d890'; btn.style.borderColor = '#1a5a3a'; btn.textContent = '✓ LOADED'; }
                // Remove banner
                const banner = document.getElementById('music-banner');
                if (banner) banner.remove();
                // Show success notif
                notif('♪ MUSIC LOADED!', 'info');
            }).catch(err => { notif('Music load failed', 'bad'); console.error(err); });
        }

        let muted = false;
        function toggleMute() {
            muted = !muted;
            if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : 1, AC.currentTime, 0.2);
            if (realAudio) realAudio.muted = muted;
            const btn = document.getElementById('btn-mute');
            if (btn) { btn.textContent = muted ? 'UNMUTE' : 'MUTE'; btn.style.color = muted ? '#ff6050' : '#607888'; }
        }

        /* ── Low-level helpers ── */
        function note(freq, start, dur, type = 'sine', vol = 0.15, dest = null) {
            if (!AC) return;
            const o = AC.createOscillator(), g = AC.createGain();
            o.type = type; o.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(vol, start + Math.min(0.02, dur * 0.1));
            g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
            o.connect(g); g.connect(dest || sfxGain);
            o.start(start); o.stop(start + dur + 0.01);
            return { o, g };
        }

        function noiseBuffer(dur) {
            const len = Math.floor(AC.sampleRate * dur);
            const buf = AC.createBuffer(1, len, AC.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            return buf;
        }

        function playNoise(dur, freq1 = 200, freq2 = 200, vol = 0.1, dest = null) {
            if (!AC) return;
            const src = AC.createBufferSource();
            src.buffer = noiseBuffer(dur);
            const filt = AC.createBiquadFilter();
            filt.type = 'bandpass'; filt.frequency.setValueAtTime(freq1, AC.currentTime);
            filt.frequency.linearRampToValueAtTime(freq2, AC.currentTime + dur);
            filt.Q.value = 0.8;
            const g = AC.createGain();
            g.gain.setValueAtTime(vol, AC.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
            src.connect(filt); filt.connect(g); g.connect(dest || sfxGain);
            src.start(); src.stop(AC.currentTime + dur + 0.05);
        }

        /* ─────────────────────────────────────────────
           BACKGROUND MUSIC
           3 themes: dungeon_ambient, battle, victory
        ───────────────────────────────────────────── */

        // ═══════════════════════════════════════════════════════════════
        // ROOM-SPECIFIC MUSIC ENGINE — 7 unique procedural themes
        // Har room ka apna sound world — pure Web Audio API
        // ═══════════════════════════════════════════════════════════════

        function stopBGM(fadeTime = 1.5) {
            if (!AC) return;
            bgmNodes.forEach(n => {
                try {
                    n.gain.setTargetAtTime(0, AC.currentTime, 0.4);
                    setTimeout(() => { try { n.node.stop() } catch (e) { } }, fadeTime * 1000);
                } catch (e) { }
            });
            bgmNodes = []; bgmRunning = false;
        }

        function startBGM(theme) {
            if (!AC) return;
            if (realMusicLoaded) return; // real music already playing
            if (currentBGM === theme) return;
            const prev = currentBGM;
            stopBGM(1.8);
            currentBGM = theme;
            const delay = prev === null ? 600 : 2000;
            setTimeout(() => {
                if (currentBGM !== theme) return;
                const map = {
                    entrance: bgmEntrance, hall: bgmHall, alley: bgmAlley,
                    library: bgmLibrary, secret: bgmSecret, battle: bgmBattle,
                    throne_clear: bgmThroneClear, victory: bgmVictory, gameover: bgmGameOver
                };
                if (map[theme]) map[theme]();
            }, delay);
        }

        function mkPad(freq, vol, detune, type) {
            if (!AC) return;
            const o = AC.createOscillator(), g = AC.createGain();
            o.type = type || 'sine'; o.frequency.value = freq; o.detune.value = detune || 0;
            g.gain.setValueAtTime(0, AC.currentTime);
            g.gain.linearRampToValueAtTime(vol, AC.currentTime + 2.5);
            o.connect(g); g.connect(musicGain); o.start();
            bgmNodes.push({ node: o, gain: g });
        }

        function mkWind(freq, vol, theme) {
            if (!bgmRunning || currentBGM !== theme) return;
            const buf = noiseBuffer(6), src = AC.createBufferSource(); src.buffer = buf;
            const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.5;
            const g = AC.createGain(); g.gain.value = vol;
            src.connect(f); f.connect(g); g.connect(musicGain);
            src.onended = () => mkWind(freq, vol, theme);
            src.start();
        }

        /* ──────────────────────────────────────────────
           ENTRANCE — "The Gate of No Return"
           D Phrygian drone + haunting bells + heartbeat
           Mood: foreboding, ancient, mysterious
        ────────────────────────────────────────────── */
        // ── 3 BGM themes: dungeon, battle, victory ──────────────
        function bgmDungeon() {
            if (!AC) return; bgmRunning = true; const T = 'dungeon';
            // Deep drone
            [36.7, 73.4, 73.6, 110].forEach((f, i) => mkPad(f, [0.055, 0.045, 0.040, 0.025][i], i * 3, 'sawtooth'));
            const lfo = AC.createOscillator(), lg = AC.createGain();
            lfo.frequency.value = 0.10; lg.gain.value = 0.012; lfo.connect(lg); lfo.start(); bgmNodes.push({ node: lfo, gain: lg });
            mkWind(220, 0.032, T); mkWind(80, 0.022, T);
            // Haunting bells
            const bells = [146.8, 174.6, 220, 261.6, 196, 174.6, 146.8, 233.1]; let bi = 0;
            function bellTick() {
                if (!bgmRunning || currentBGM !== T) return;
                const f = bells[bi % bells.length]; bi++; const t = AC.currentTime;
                note(f, t, 4.0, 'sine', 0.055, musicGain); note(f * 2, t + 0.01, 2.2, 'sine', 0.022, musicGain); note(f * .5, t + 0.02, 3.0, 'sine', 0.018, musicGain);
                setTimeout(bellTick, 2000 + Math.random() * 2500);
            }
            setTimeout(bellTick, 1200);
            // Eerie melody
            const mel = [146.8, 155.6, 174.6, 196, 220, 233.1, 174.6, 155.6]; let mi = 0;
            function melTick() {
                if (!bgmRunning || currentBGM !== T) return;
                const f = mel[mi % mel.length]; mi++; const t = AC.currentTime;
                const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
                o.type = 'triangle'; o.frequency.value = f / 2; fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 4;
                g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.068, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
                o.connect(fl); fl.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 3.1); bgmNodes.push({ node: o, gain: g });
                setTimeout(melTick, 2500 + Math.random() * 1500);
            }
            setTimeout(melTick, 3500);
            // Heartbeat
            function hb() {
                if (!bgmRunning || currentBGM !== T) return;
                playNoise(0.15, 70, 40, 0.058, musicGain);
                setTimeout(() => { if (bgmRunning && currentBGM === T) playNoise(0.10, 60, 35, 0.040, musicGain); }, 230);
                setTimeout(hb, 5500 + Math.random() * 4000);
            }
            setTimeout(hb, 5000);
        }

        function bgmBattle() {
            if (!AC) return; bgmRunning = true; const T = 'battle';
            const BPM = 138, beat = 60 / BPM;
            // Kick
            function kick() {
                if (!bgmRunning || currentBGM !== T) return;
                const t = AC.currentTime; const o = AC.createOscillator(), g = AC.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.13);
                g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
                o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.27); bgmNodes.push({ node: o, gain: g });
                setTimeout(kick, beat * 1000);
            }
            kick();
            // Snare
            let sni = 0;
            function snare() { if (!bgmRunning || currentBGM !== T) return; sni++; if (sni % 2 === 0) { playNoise(0.09, 2200, 900, 0.13, musicGain); playNoise(0.05, 6000, 2500, 0.05, musicGain); } setTimeout(snare, beat * 2 * 1000); }
            setTimeout(snare, beat * 1000);
            // Bass riff
            const riff = [82.4, 82.4, 0, 82.4, 98, 98, 87.3, 0, 73.4, 73.4, 0, 82.4, 87.3, 82.4, 73.4, 0]; let bri = 0;
            function bassR() {
                if (!bgmRunning || currentBGM !== T) return; const f = riff[bri % riff.length]; bri++;
                if (f > 0) {
                    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
                    o.type = 'sawtooth'; o.frequency.value = f; g.gain.setValueAtTime(0.088, t); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.88);
                    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + beat); bgmNodes.push({ node: o, gain: g });
                }
                setTimeout(bassR, beat * 1000);
            }
            bassR();
            // Tremolo strings
            const strN = [164.8, 174.6, 164.8, 155.6, 164.8, 196]; let sti = 0;
            function strT() {
                if (!bgmRunning || currentBGM !== T) return; const f = strN[sti % strN.length]; sti++; const t = AC.currentTime;
                for (let r = 0; r < 10; r++)note(f, t + r * beat * 0.1, beat * 0.11, 'sawtooth', 0.026 + (r % 2) * 0.007, musicGain);
                setTimeout(strT, beat * 4 * 1000);
            }
            setTimeout(strT, 400);
            // Brass
            const bH = [82.4, 87.3, 73.4, 82.4, 98]; let bhi = 0;
            function brass() {
                if (!bgmRunning || currentBGM !== T) return; const f = bH[bhi % bH.length]; bhi++; const t = AC.currentTime;
                [f, f * 1.5, f * 2].forEach((fr, i) => {
                    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = i * 7;
                    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.068 - i * 0.015, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
                    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 1.0); bgmNodes.push({ node: o, gain: g });
                });
                setTimeout(brass, beat * 8 * 1000);
            }
            setTimeout(brass, 1800);
        }

        function bgmVictory() {
            if (!AC) return; bgmRunning = true; const t0 = AC.currentTime + 0.2;
            [[130.8, 0], [164.8, 0.28], [196, 0.56], [261.6, 0.84], [329.6, 1.12], [392, 1.45], [523.2, 1.85]].forEach(([f, dt]) => {
                const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
                g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(0.12, t0 + dt + 0.07);
                g.gain.setValueAtTime(0.12, t0 + dt + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 1.0);
                o.connect(g); g.connect(musicGain); o.start(t0 + dt); o.stop(t0 + dt + 1.1); bgmNodes.push({ node: o, gain: g });
                note(f * 2, t0 + dt + 0.02, 0.8, 'sine', 0.05, musicGain); playNoise(0.06, f * 4, f * 2, 0.04, musicGain);
            });
            [130.8, 164.8, 196, 261.6, 329.6].forEach((f, i) => note(f, t0 + 2.5 + i * 0.04, 5.0, 'sine', 0.065 - i * 0.008, musicGain));
            [523.2, 659.2, 784, 1046.4, 1318.5, 1568].forEach((f, i) => note(f, t0 + 2.8 + i * 0.16, 2.2, 'sine', 0.048, musicGain));
            setTimeout(() => {
                if (currentBGM !== 'victory') return;[130.8, 164.8, 196, 261.6].forEach(f => mkPad(f, 0.034, 0, 'sine'));
                const mel = [261.6, 329.6, 392, 329.6, 261.6, 196, 220, 261.6]; let si = 0;
                function sn() { if (!bgmRunning || currentBGM !== 'victory') return; const f = mel[si % mel.length]; si++; note(f, AC.currentTime, 2.6, 'sine', 0.045, musicGain); setTimeout(sn, 2200 + Math.random() * 800); } sn();
            }, 6500);
        }

        // BGM aliases for room mapping
        function bgmEntrance() { bgmDungeon(); }
        function bgmHall() { bgmDungeon(); }
        function bgmAlley() { bgmDungeon(); }
        function bgmLibrary() { bgmDungeon(); }
        function bgmSecret() { bgmDungeon(); }
        function bgmThroneClear() { bgmVictory(); }
        function bgmGameOver() {
            if (!AC) return; bgmRunning = true; const t0 = AC.currentTime + 0.3;
            [220, 196, 174.6, 164.8, 155.6, 146.8, 130.8, 110].forEach((f, i) => {
                const dt = i * 0.82;
                note(f, t0 + dt, 1.4, 'sawtooth', 0.07, musicGain); note(f / 2, t0 + dt + 0.06, 1.1, 'sine', 0.04, musicGain);
            });
            [[110, 0], [138.6, 2.2], [110, 4.4]].forEach(([f, dt]) => { note(f, t0 + 8 + dt, 4.0, 'sine', 0.078, musicGain); note(f * 3, t0 + 8 + dt + 0.06, 2.8, 'sine', 0.028, musicGain); });
            setTimeout(() => { if (currentBGM !== 'gameover') return; mkPad(55, 0.036, 0, 'sawtooth'); mkWind(80, 0.022, 'gameover'); }, 8500);
        }

        function playPickup() {
            if (!AC) return;
            const t = AC.currentTime;
            note(600, t, 0.07, 'sine', 0.18);
            note(800, t + 0.07, 0.07, 'sine', 0.14);
            note(1000, t + 0.13, 0.12, 'sine', 0.12);
            playNoise(0.06, 2000, 4000, 0.04);
        }

        function playItemMagic() {  // for spellbook / key
            if (!AC) return;
            const t = AC.currentTime;
            [523.2, 659.2, 784, 1046.4, 1318.5].forEach((f, i) => note(f, t + i * 0.07, 0.25, 'sine', 0.09));
            playNoise(0.3, 3000, 8000, 0.03);
        }

        function playStep() {
            if (!AC) return;
            playNoise(0.06, 120 + Math.random() * 40, 80, 0.055);
        }

        function playDoorOpen() {
            if (!AC) return;
            const t = AC.currentTime;
            playNoise(0.4, 200, 80, 0.12);
            note(80, t, 0.3, 'sawtooth', 0.06);
            setTimeout(() => { playNoise(0.2, 150, 60, 0.06); }, 350);
        }

        function playDamage() {
            if (!AC) return;
            const t = AC.currentTime;
            playNoise(0.08, 1200, 200, 0.25);
            note(80, t, 0.4, 'sawtooth', 0.22);
            note(60, t + 0.08, 0.3, 'sawtooth', 0.15);
            note(55, t + 0.18, 0.3, 'sine', 0.10);
            // low rumble
            for (let i = 0; i < 3; i++) playNoise(0.15, 60 - i * 10, 40, 0.08);
        }

        function playDragon() {
            if (!AC) return;
            const t = AC.currentTime;
            // Deep roar
            const o = AC.createOscillator(), g = AC.createGain(), dist = AC.createWaveShaper();
            const curve = new Float32Array(512);
            for (let i = 0; i < 512; i++) { const x = i * 2 / 512 - 1; curve[i] = Math.tanh(x * 6) * 0.8; }
            dist.curve = curve;
            o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(35, t + 1.5);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.30, t + 0.1);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
            o.connect(dist); dist.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 2.1);
            // Fire breath noise
            setTimeout(() => playNoise(0.8, 3000, 800, 0.18), 300);
            setTimeout(() => playNoise(0.5, 4000, 600, 0.12), 700);
            // Stomp
            setTimeout(() => { playNoise(0.2, 80, 40, 0.20); note(40, AC.currentTime, 0.3, 'sawtooth', 0.15); }, 800);
        }

        function playFireBreath() {
            if (!AC) return;
            playNoise(1.2, 5000, 1000, 0.22);
            playNoise(0.8, 8000, 2000, 0.12);
            note(60, AC.currentTime, 0.8, 'sawtooth', 0.08);
        }

        function playSwordSwing() {
            if (!AC) return;
            playNoise(0.15, 4000, 800, 0.18);
            note(220, AC.currentTime, 0.1, 'sawtooth', 0.07);
        }

        function playSwordHit() {
            if (!AC) return;
            playNoise(0.08, 3000, 600, 0.20);
            note(180, AC.currentTime, 0.12, 'sawtooth', 0.12);
            note(110, AC.currentTime + 0.05, 0.2, 'sawtooth', 0.08);
        }

        function playChestOpen() {
            if (!AC) return;
            const t = AC.currentTime;
            playNoise(0.5, 200, 80, 0.15);    // creak
            note(98, t, 0.3, 'sawtooth', 0.08);
            note(110, t + 0.08, 0.2, 'sawtooth', 0.05);
            // shimmer after opening
            setTimeout(() => { [523.2, 659.2, 784, 1046.4].forEach((f, i) => note(f, AC.currentTime + i * 0.1, 0.4, 'sine', 0.07)); }, 500);
        }

        function playKeyClick() {
            if (!AC) return;
            note(1200, AC.currentTime, 0.06, 'square', 0.10);
            note(800, AC.currentTime + 0.04, 0.08, 'sine', 0.06);
        }

        function playTorchLight() {
            if (!AC) return;
            playNoise(0.3, 1500, 600, 0.12);
            note(220, AC.currentTime, 0.2, 'sawtooth', 0.05);
            note(440, AC.currentTime + 0.1, 0.15, 'sine', 0.04);
        }

        function playVictory() {
            startBGM('victory');
            if (!AC) return;
            const t = AC.currentTime;
            playNoise(0.1, 5000, 2000, 0.22);
            [261.6, 329.6, 392, 523.2].forEach((f, i) => note(f, t + i * 0.05, 0.5, 'sine', 0.12));
        }

        function playGameOver() {
            if (!AC) return;
            const t = AC.currentTime;
            note(220, t, 0.8, 'sawtooth', 0.12);
            note(196, t + 0.6, 0.8, 'sawtooth', 0.10);
            note(174.6, t + 1.2, 1.2, 'sawtooth', 0.08);
            note(146.8, t + 2, 2.0, 'sawtooth', 0.06);
            playNoise(0.4, 200, 60, 0.10);
        }

        function playMoveNotif() {  // room change
            if (!AC) return;
            const t = AC.currentTime;
            note(440, t, 0.08, 'sine', 0.06);
            note(523.2, t + 0.06, 0.06, 'sine', 0.04);
        }

        // ══════ CANVAS SCENES ══════
        const SCV = document.getElementById('scene-cv');
        const FGCV = document.getElementById('fog-cv');
        const SC = SCV.getContext('2d');
        const FC = FGCV.getContext('2d');
        let SW = 0, SH = 0, T = 0;
        let fogParticles = [];

        function resizeScene() {
            const r = document.getElementById('scene-wrap').getBoundingClientRect();
            SW = SCV.width = FGCV.width = r.width;
            SH = SCV.height = FGCV.height = r.height;
            if (!fogParticles.length) initFog();
        }

        function initFog() {
            fogParticles = [];
            for (let i = 0; i < 25; i++) {
                fogParticles.push({
                    x: Math.random() * 2000, y: SH * 0.4 + Math.random() * SH * 0.5,
                    w: 120 + Math.random() * 200, h: 30 + Math.random() * 50,
                    spd: 0.15 + Math.random() * 0.25, op: 0.03 + Math.random() * 0.06
                });
            }
        }

        function drawFog() {
            FC.clearRect(0, 0, SW, SH);
            fogParticles.forEach(p => {
                p.x -= p.spd;
                if (p.x + p.w < 0) p.x = SW + p.w;
                FC.fillStyle = `rgba(80,110,160,${p.op})`;
                FC.beginPath(); FC.ellipse(p.x, p.y, p.w, p.h, 0, 0, Math.PI * 2); FC.fill();
            });
        }

        function flicker() { return 0.82 + 0.18 * Math.sin(T * 14) + 0.06 * Math.sin(T * 31) + 0.04 * Math.sin(T * 53) }

        function drawFlame(x, y, size, t) {
            const f = flicker(), r = size * (0.9 + 0.1 * Math.sin(t * 8 + x));
            for (let l = 0; l < 4; l++) {
                const g = SC.createRadialGradient(x, y, 0, x, y - r * (0.6 + l * 0.15), r * (1 + l * 0.4));
                const cols = ['rgba(255,240,160', 'rgba(255,160,40', 'rgba(255,80,0', 'rgba(180,40,0'];
                const alpha = [0.95, 0.7, 0.45, 0.2];
                g.addColorStop(0, `${cols[l]},${alpha[l] * f})`);
                g.addColorStop(1, `${cols[l]},0)`);
                SC.fillStyle = g;
                SC.beginPath();
                SC.ellipse(x + (l - 1.5) * size * 0.15, y - r * 0.3, r * (0.4 + l * 0.1), r * (0.9 + l * 0.15), Math.sin(t * 4 + l) * 0.2, 0, Math.PI * 2);
                SC.fill();
            }
            // wall glow
            const wg = SC.createRadialGradient(x, y, 0, x, y, size * 5);
            wg.addColorStop(0, `rgba(220,120,20,${0.18 * f})`); wg.addColorStop(1, 'transparent');
            SC.fillStyle = wg; SC.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
        }

        function drawWallTorch(x, y, t) {
            SC.fillStyle = '#2a1a08'; SC.fillRect(x - 3, y + 4, 6, 18);
            SC.fillStyle = '#1a0c04'; SC.fillRect(x - 6, y, 12, 8);
            drawFlame(x, y - 2, 10, t);
        }

        function drawItemFloat(x, y, emoji, col, t) {
            const bob = Math.sin(t * 2.5) * 4;
            const g = SC.createRadialGradient(x, y + bob, 0, x, y + bob, 28);
            g.addColorStop(0, col.replace(')', ',0.3)')); g.addColorStop(1, 'transparent');
            SC.fillStyle = g; SC.fillRect(x - 28, y + bob - 28, 56, 56);
            SC.font = '22px serif'; SC.textAlign = 'center'; SC.textBaseline = 'middle';
            SC.globalAlpha = 0.9 + 0.1 * Math.sin(t * 3);
            SC.fillText(emoji, x, y + bob); SC.globalAlpha = 1;
        }

        const SCENES = {
            entrance(t) {
                // sky/ground gradient
                let g = SC.createLinearGradient(0, 0, 0, SH);
                g.addColorStop(0, '#030609'); g.addColorStop(0.5, '#060c14'); g.addColorStop(1, '#080e1a');
                SC.fillStyle = g; SC.fillRect(0, 0, SW, SH);
                // stone blocks
                SC.strokeStyle = 'rgba(20,32,48,0.7)'; SC.lineWidth = 0.8;
                for (let r = 0; r < 16; r++)for (let c = 0; c < 10; c++) {
                    const ox = r % 2 ? 40 : 0; SC.strokeRect(c * 80 + ox, r * 28, 80, 28);
                }
                // arch door
                const cx = SW / 2, cy = SH * 0.48;
                // door shadow
                const ds = SC.createRadialGradient(cx, cy, 0, cx, cy, 100);
                ds.addColorStop(0, `rgba(200,130,20,${0.2 * flicker()})`); ds.addColorStop(1, 'transparent');
                SC.fillStyle = ds; SC.fillRect(cx - 100, cy - 120, 200, 200);
                // door frame
                SC.strokeStyle = 'rgba(100,70,20,0.7)'; SC.lineWidth = 5;
                SC.beginPath(); SC.moveTo(cx - 52, cy + 60); SC.lineTo(cx - 52, cy - 60);
                SC.arc(cx, cy - 60, 52, Math.PI, 0);
                SC.lineTo(cx + 52, cy + 60); SC.stroke();
                // door interior
                SC.fillStyle = '#010204';
                SC.beginPath(); SC.moveTo(cx - 48, cy + 58); SC.lineTo(cx - 48, cy - 58);
                SC.arc(cx, cy - 58, 48, Math.PI, 0); SC.lineTo(cx + 48, cy + 58); SC.fill();
                // door hinges/handle
                SC.fillStyle = 'rgba(80,50,10,0.6)';
                SC.fillRect(cx - 48, cy - 40, 8, 12); SC.fillRect(cx - 48, cy + 10, 8, 12);
                SC.fillRect(cx + 40, cy - 40, 8, 12); SC.fillRect(cx + 40, cy + 10, 8, 12);
                SC.fillStyle = 'rgba(120,80,20,0.8)'; SC.beginPath(); SC.arc(cx, cy, 6, 0, Math.PI * 2); SC.fill();
                // torches
                drawWallTorch(cx - 130, cy - 30, t); drawWallTorch(cx + 130, cy - 30, t);
                // ground
                SC.fillStyle = '#04080e'; SC.fillRect(0, SH * 0.82, SW, SH * 0.18);
                SC.strokeStyle = 'rgba(12,22,36,0.5)'; SC.lineWidth = 0.5;
                for (let i = 0; i < 6; i++)for (let j = 0; j < 12; j++)SC.strokeRect(j * (SW / 12), SH * 0.82 + i * 14, SW / 12, 14);
                // items
                if (!S.flags.torchTaken) drawItemFloat(cx - 100, SH * 0.72, '🔦', 'rgba(240,165,0', t);
                if (!S.flags.mapTaken) drawItemFloat(cx + 100, SH * 0.72, '🗺️', 'rgba(60,140,220', t);
                // stars in door
                for (let s = 0; s < 8; s++) {
                    const sx = cx - 30 + Math.sin(s * 1.8 + t) * 20, sy = cy - 30 + Math.cos(s * 2.3 + t * 0.7) * 20;
                    SC.fillStyle = `rgba(160,180,220,${0.06 + 0.04 * Math.sin(t + s)})`;
                    SC.beginPath(); SC.arc(sx, sy, 0.8, 0, Math.PI * 2); SC.fill();
                }
            },

            hall(t) {
                if (!S.flags.torchLit) {
                    let dg = SC.createRadialGradient(SW / 2, SH / 2, 0, SW / 2, SH / 2, 60);
                    dg.addColorStop(0, '#08101c'); dg.addColorStop(1, '#020408');
                    SC.fillStyle = dg; SC.fillRect(0, 0, SW, SH);
                    SC.fillStyle = 'rgba(200,100,20,0.12)';
                    SC.font = 'bold 14px Cinzel, serif'; SC.textAlign = 'center';
                    SC.fillText('– ANDHERA –', SW / 2, SH / 2 - 10);
                    SC.fillStyle = 'rgba(150,80,20,0.07)'; SC.font = '11px Cinzel, serif';
                    SC.fillText('torch ke bina kuch nahi dikh raha', SW / 2, SH / 2 + 14);
                    return;
                }
                SC.fillStyle = '#040910'; SC.fillRect(0, 0, SW, SH);
                // perspective lines
                SC.strokeStyle = 'rgba(16,28,44,0.6)'; SC.lineWidth = 0.6;
                for (let i = 0; i < 8; i++)SC.strokeRect(i * (SW / 8), i * 20, SW - i * (SW / 4), SH - i * 40);
                // columns
                for (let i = 0; i < 4; i++) {
                    const cx2 = SW * 0.12 + i * (SW * 0.25);
                    SC.fillStyle = '#060c18'; SC.fillRect(cx2 - 14, 0, 28, SH);
                    SC.strokeStyle = 'rgba(30,50,70,0.4)'; SC.lineWidth = 1; SC.strokeRect(cx2 - 14, 0, 28, SH);
                    SC.fillStyle = 'rgba(30,50,70,0.3)'; SC.fillRect(cx2 - 16, 0, 32, 12); SC.fillRect(cx2 - 16, SH - 12, 32, 12);
                }
                // paintings
                const paint = (px, py, pw, ph, icon) => {
                    SC.fillStyle = '#080812'; SC.fillRect(px, py, pw, ph);
                    SC.strokeStyle = 'rgba(80,55,15,0.5)'; SC.lineWidth = 3; SC.strokeRect(px, py, pw, ph);
                    SC.strokeStyle = 'rgba(50,35,10,0.4)'; SC.lineWidth = 1; SC.strokeRect(px + 5, py + 5, pw - 10, ph - 10);
                    SC.font = `${ph * 0.6}px serif`; SC.textAlign = 'center'; SC.textBaseline = 'middle';
                    SC.globalAlpha = 0.4; SC.fillText(icon, px + pw / 2, py + ph / 2); SC.globalAlpha = 1;
                };
                paint(SW * 0.18, 18, 90, 68, '⚔️'); paint(SW * 0.55, 18, 90, 68, '🐉');
                // floor
                SC.fillStyle = '#040810'; SC.fillRect(0, SH * 0.72, SW, SH * 0.28);
                SC.strokeStyle = 'rgba(14,24,38,0.5)'; SC.lineWidth = 0.4;
                for (let r = 0; r < 5; r++)for (let c = 0; c < 12; c++)SC.strokeRect(c * (SW / 12), SH * 0.72 + r * 16, SW / 12, 16);
                drawWallTorch(SW * 0.08, SH * 0.42, t); drawWallTorch(SW * 0.92, SH * 0.42, t);
                if (!S.flags.swordTaken) drawItemFloat(SW * 0.35, SH * 0.74, '⚔️', 'rgba(180,200,220', t);
                if (!S.flags.shieldTaken) drawItemFloat(SW * 0.65, SH * 0.74, '🛡️', 'rgba(80,120,180', t);
            },

            alley(t) {
                SC.fillStyle = '#020406'; SC.fillRect(0, 0, SW, SH);
                SC.fillStyle = '#03060c'; SC.fillRect(0, 0, SW * 0.28, SH); SC.fillRect(SW * 0.72, 0, SW * 0.28, SH);
                SC.strokeStyle = 'rgba(10,18,28,0.7)'; SC.lineWidth = 0.7;
                for (let r = 0; r < 18; r++) { const ox = r % 2 ? 35 : 0; for (let c = 0; c < 5; c++)SC.strokeRect(c * 70 + ox, r * 26, 70, 26) }
                // moon
                SC.fillStyle = `rgba(160,175,210,${0.06 + 0.02 * Math.sin(t)})`;
                SC.beginPath(); SC.arc(SW / 2, -5, 24, 0, Math.PI); SC.fill();
                const mg = SC.createRadialGradient(SW / 2, 0, 0, SW / 2, 0, 80);
                mg.addColorStop(0, 'rgba(140,160,200,0.08)'); mg.addColorStop(1, 'transparent');
                SC.fillStyle = mg; SC.fillRect(SW / 2 - 80, 0, 160, 80);
                // moss on walls
                SC.fillStyle = 'rgba(20,50,20,0.15)';
                for (let i = 0; i < 5; i++)SC.fillRect(20 + i * 8, SH * 0.2 + i * 30, 4, 20 + i * 10);
                for (let i = 0; i < 5; i++)SC.fillRect(SW - 40 + i * 6, SH * 0.3 + i * 25, 4, 18 + i * 8);
                if (!S.flags.keyTaken) drawItemFloat(SW / 2, SH * 0.68, '🗝️', 'rgba(200,165,50', t);
            },

            library(t) {
                SC.fillStyle = '#040710'; SC.fillRect(0, 0, SW, SH);
                // bookshelves with detail
                const bColors = ['#2a1808', '#1a0818', '#0a1808', '#181400', '#200810'];
                for (let sh = 0; sh < 3; sh++) {
                    SC.fillStyle = '#0a0810'; SC.fillRect(0, sh * 68, SW, 68);
                    SC.strokeStyle = 'rgba(40,25,10,0.4)'; SC.lineWidth = 1; SC.strokeRect(0, sh * 68, SW, 68);
                    for (let b = 0; b < Math.floor(SW / 22); b++) {
                        const bh = 35 + Math.sin(b * 1.7 + sh * 2.1) * 18;
                        SC.fillStyle = bColors[(b * 3 + sh) % 5];
                        SC.fillRect(b * 22 + 2, sh * 68 + 68 - bh, 19, bh);
                        SC.strokeStyle = 'rgba(60,40,15,0.2)'; SC.lineWidth = 0.5; SC.strokeRect(b * 22 + 2, sh * 68 + 68 - bh, 19, bh);
                        // book spine line
                        SC.strokeStyle = 'rgba(100,70,20,0.15)'; SC.lineWidth = 0.5;
                        SC.beginPath(); SC.moveTo(b * 22 + 11, sh * 68 + 68 - bh); SC.lineTo(b * 22 + 11, sh * 68 + 68); SC.stroke();
                    }
                }
                // reading table
                SC.fillStyle = '#090700'; SC.fillRect(SW * 0.18, SH * 0.64, SW * 0.64, 16);
                SC.fillStyle = '#060500'; SC.fillRect(SW * 0.22, SH * 0.8, SW * 0.1, SH * 0.2); SC.fillRect(SW * 0.68, SH * 0.8, SW * 0.1, SH * 0.2);
                // candles on table
                const drawCandle = (cx2, cy2) => {
                    SC.fillStyle = '#d0c080'; SC.fillRect(cx2 - 3, cy2, 6, 16);
                    SC.fillStyle = '#1a0e04'; SC.fillRect(cx2 - 5, cy2 + 14, 10, 5);
                    drawFlame(cx2, cy2 - 2, 7, t);
                };
                drawCandle(SW * 0.38, SH * 0.55); drawCandle(SW * 0.62, SH * 0.55);
                drawWallTorch(SW * 0.06, SH * 0.52, t); drawWallTorch(SW * 0.94, SH * 0.52, t);
                if (!S.flags.spellTaken && S.inv.includes('map')) drawItemFloat(SW / 2, SH * 0.48, '📖', 'rgba(130,60,220', t);
            },

            secret(t) {
                SC.fillStyle = '#030508'; SC.fillRect(0, 0, SW, SH);
                SC.strokeStyle = 'rgba(12,20,30,0.8)'; SC.lineWidth = 0.8;
                for (let r = 0; r < 14; r++) { const ox = r % 2 ? 36 : 0; for (let c = 0; c < 7; c++)SC.strokeRect(c * 64 + ox, r * 28, 64, 28) }
                // cobwebs
                const web = (wx, wy, wr) => {
                    SC.strokeStyle = 'rgba(80,100,120,0.08)'; SC.lineWidth = 0.4;
                    for (let i = 0; i < 6; i++) { SC.beginPath(); SC.moveTo(wx, wy); SC.lineTo(wx + Math.cos(i * Math.PI / 3) * wr, wy + Math.sin(i * Math.PI / 3) * wr); SC.stroke() }
                    for (let r2 = 0.3; r2 <= 1; r2 += 0.35) { SC.beginPath(); SC.arc(wx, wy, wr * r2, 0, Math.PI * 2); SC.stroke() }
                };
                web(20, 20, 40); web(SW - 20, 30, 35); web(SW - 15, SH - 20, 30);
                // chest
                const cx3 = SW / 2, cy3 = SH * 0.54;
                const chestCol = S.flags.chestOpen ? 'rgba(200,148,26' : 'rgba(60,100,180';
                const cg = SC.createRadialGradient(cx3, cy3, 0, cx3, cy3, 70);
                cg.addColorStop(0, `${chestCol},${0.3 * flicker()})`); cg.addColorStop(1, 'transparent');
                SC.fillStyle = cg; SC.fillRect(cx3 - 70, cy3 - 70, 140, 140);
                // chest body
                SC.fillStyle = S.flags.chestOpen ? '#2a1800' : '#120c00';
                SC.fillRect(cx3 - 42, cy3 - 20, 84, 48);
                SC.fillStyle = S.flags.chestOpen ? '#1a1000' : '#0c0800';
                SC.fillRect(cx3 - 44, cy3 - 34, 88, 18); SC.beginPath(); SC.arc(cx3, cy3 - 26, 44, Math.PI, 0); SC.fill();
                // chest bands
                SC.strokeStyle = 'rgba(100,70,20,0.5)'; SC.lineWidth = 3;
                SC.strokeRect(cx3 - 42, cy3 - 20, 84, 48); SC.beginPath(); SC.arc(cx3, cy3 - 26, 44, Math.PI, 0); SC.stroke();
                SC.strokeStyle = 'rgba(100,70,20,0.3)'; SC.lineWidth = 1.5;
                SC.beginPath(); SC.moveTo(cx3, cy3 - 34); SC.lineTo(cx3, cy3 + 28); SC.stroke();
                // lock
                if (!S.flags.chestOpen) {
                    SC.fillStyle = 'rgba(180,140,40,0.9)'; SC.fillRect(cx3 - 8, cy3 - 28, 16, 12);
                    SC.strokeStyle = 'rgba(220,180,60,0.7)'; SC.lineWidth = 2;
                    SC.beginPath(); SC.arc(cx3, cy3 - 31, 5, Math.PI, 0); SC.stroke();
                }
                // sparkle if open
                if (S.flags.chestOpen) {
                    for (let s = 0; s < 6; s++) {
                        const ang = t * 2 + s * Math.PI / 3, dist = 30 + Math.sin(t * 3 + s) * 15;
                        SC.fillStyle = `rgba(255,220,80,${0.4 + 0.3 * Math.sin(t * 4 + s)})`;
                        SC.beginPath(); SC.arc(cx3 + Math.cos(ang) * dist, cy3 + Math.sin(ang) * dist, 2, 0, Math.PI * 2); SC.fill();
                    }
                }
            },

            crypt(t) {
                SC.fillStyle = '#020306'; SC.fillRect(0, 0, SW, SH);
                // tombstones
                for (let i = 0; i < 7; i++) {
                    const x = SW * 0.1 + i * (SW * 0.12), y = SH * 0.55;
                    SC.fillStyle = '#0a0e18'; SC.fillRect(x - 10, y - 30, 20, 30);
                    SC.beginPath(); SC.arc(x, y - 30, 10, Math.PI, 0); SC.fill();
                    SC.strokeStyle = 'rgba(40,60,80,0.4)'; SC.lineWidth = 1; SC.strokeRect(x - 10, y - 30, 20, 30);
                }
                // ghost
                const ga = 0.5 + 0.3 * Math.sin(t * 2), gx = SW * 0.7, gy = SH * 0.4 + Math.sin(t) * 10;
                SC.fillStyle = `rgba(160,200,255,${ga * 0.15})`; SC.beginPath(); SC.ellipse(gx, gy, 20, 30, 0, 0, Math.PI * 2); SC.fill();
                SC.fillStyle = `rgba(180,220,255,${ga * 0.6})`; SC.font = '28px serif'; SC.textAlign = 'center'; SC.fillText('👻', gx, gy + 10);
                // altar glow
                const ag = SC.createRadialGradient(SW / 2, SH * 0.75, 0, SW / 2, SH * 0.75, 50);
                ag.addColorStop(0, `rgba(220,180,80,${0.2 * flicker()})`); ag.addColorStop(1, 'transparent');
                SC.fillStyle = ag; SC.fillRect(SW / 2 - 50, SH * 0.65, 100, 60);
                if (!S.flags.potionTaken) drawItemFloat(SW * 0.45, SH * 0.75, '🧪', 'rgba(220,50,50', t);
                if (!S.flags.holyWaterTaken) drawItemFloat(SW * 0.55, SH * 0.75, '💧', 'rgba(80,160,240', t);
                drawWallTorch(SW * 0.05, SH * 0.5, t); drawWallTorch(SW * 0.95, SH * 0.5, t);
            },
            well(t) {
                SC.fillStyle = '#030810'; SC.fillRect(0, 0, SW, SH);
                // well structure
                const wx = SW / 2, wy = SH * 0.5;
                SC.fillStyle = '#080e1a'; SC.beginPath(); SC.arc(wx, wy, 55, 0, Math.PI * 2); SC.fill();
                SC.strokeStyle = 'rgba(40,80,120,0.6)'; SC.lineWidth = 4; SC.beginPath(); SC.arc(wx, wy, 55, 0, Math.PI * 2); SC.stroke();
                // water glow inside well
                const wg = SC.createRadialGradient(wx, wy, 0, wx, wy, 40);
                wg.addColorStop(0, `rgba(80,160,240,${0.4 + 0.15 * Math.sin(t * 2)})`); wg.addColorStop(1, 'transparent');
                SC.fillStyle = wg; SC.beginPath(); SC.arc(wx, wy, 40, 0, Math.PI * 2); SC.fill();
                // water ripples
                for (let r = 1; r < 4; r++) {
                    SC.strokeStyle = `rgba(100,180,255,${(0.4 - r * 0.1) * Math.sin(t * 1.5 + r)})`; SC.lineWidth = 1;
                    SC.beginPath(); SC.arc(wx, wy, 10 + r * 8 + Math.sin(t + r) * 3, 0, Math.PI * 2); SC.stroke();
                }
                // rope
                if (!S.flags.ropeTaken) { drawItemFloat(wx + 70, SH * 0.55, '🪢', 'rgba(160,120,60', t); }
                SC.fillStyle = '#060c14'; SC.fillRect(0, SH * 0.8, SW, SH * 0.2);
            },
            garden(t) {
                SC.fillStyle = '#020a06'; SC.fillRect(0, 0, SW, SH);
                // bioluminescent plants
                for (let i = 0; i < 18; i++) {
                    const px = SW * 0.05 + i * (SW / 18), ph = 40 + Math.sin(i * 1.8) * 20;
                    const isBlue = i % 3 !== 2;
                    const col = isBlue ? `rgba(40,160,255,${0.6 + 0.2 * Math.sin(t * 2 + i)})` : `rgba(220,40,40,${0.5 + 0.2 * Math.sin(t * 3 + i)})`;
                    SC.fillStyle = col; SC.fillRect(px - 3, SH * 0.7 - ph, 6, ph + SH * 0.3);
                    // glow
                    const gg = SC.createRadialGradient(px, SH * 0.7 - ph / 2, 0, px, SH * 0.7 - ph / 2, 20);
                    gg.addColorStop(0, isBlue ? `rgba(40,160,255,0.15)` : `rgba(220,40,40,0.12)`); gg.addColorStop(1, 'transparent');
                    SC.fillStyle = gg; SC.fillRect(px - 20, SH * 0.5 - ph, 40, ph + SH * 0.2);
                }
                if (!S.flags.herbTaken) drawItemFloat(SW * 0.3, SH * 0.62, '🌿', 'rgba(40,200,100', t);
                if (!S.flags.poisonHerbTaken) drawItemFloat(SW * 0.7, SH * 0.62, '☠️', 'rgba(200,40,40', t);
            },
            barracks(t) {
                SC.fillStyle = '#060810'; SC.fillRect(0, 0, SW, SH);
                // beds/furniture
                for (let i = 0; i < 4; i++) { SC.fillStyle = '#0a0c18'; SC.fillRect(SW * 0.1 + i * (SW / 4.5), SH * 0.5, SW / 5, SH * 0.3); }
                // skeleton guard
                if (!S.flags.skeletonDefeated) {
                    const sx = SW * 0.5, sy = SH * 0.38;
                    SC.fillStyle = 'rgba(200,210,220,0.7)';
                    SC.font = '48px serif'; SC.textAlign = 'center'; SC.fillText('💀', sx, sy + 15);
                    const seg = SC.createRadialGradient(sx, sy, 0, sx, sy, 50);
                    seg.addColorStop(0, `rgba(200,50,50,${0.15 + 0.05 * Math.sin(t * 3)})`); seg.addColorStop(1, 'transparent');
                    SC.fillStyle = seg; SC.fillRect(sx - 50, sy - 50, 100, 100);
                }
                if (!S.flags.lanternTaken) drawItemFloat(SW * 0.2, SH * 0.55, '🏮', 'rgba(240,180,40', t);
                drawWallTorch(SW * 0.07, SH * 0.45, t); drawWallTorch(SW * 0.93, SH * 0.45, t);
            },
            armory(t) {
                SC.fillStyle = '#060a10'; SC.fillRect(0, 0, SW, SH);
                // weapon racks on wall
                SC.strokeStyle = 'rgba(60,80,100,0.5)'; SC.lineWidth = 2;
                for (let i = 0; i < 5; i++) { SC.beginPath(); SC.moveTo(SW * 0.1 + i * (SW / 5), 0); SC.lineTo(SW * 0.1 + i * (SW / 5), SH * 0.6); SC.stroke(); }
                // armor stand
                SC.fillStyle = 'rgba(140,160,180,0.2)'; SC.font = '52px serif'; SC.textAlign = 'center'; SC.fillText('🛡️', SW / 2, SH * 0.45);
                const ag = SC.createRadialGradient(SW / 2, SH * 0.4, 0, SW / 2, SH * 0.4, 70);
                ag.addColorStop(0, `rgba(140,160,200,${0.12 + 0.05 * Math.sin(t * 2)})`); ag.addColorStop(1, 'transparent');
                SC.fillStyle = ag; SC.fillRect(SW / 2 - 70, SH * 0.2, 140, 120);
                if (!S.flags.armorTaken) drawItemFloat(SW * 0.35, SH * 0.65, '🛡️', 'rgba(140,160,200', t);
                if (!S.flags.poisondaggerTaken) drawItemFloat(SW * 0.65, SH * 0.65, '🗡️', 'rgba(160,40,40', t);
                drawWallTorch(SW * 0.08, SH * 0.48, t); drawWallTorch(SW * 0.92, SH * 0.48, t);
            },
            oracle(t) {
                SC.fillStyle = '#080410'; SC.fillRect(0, 0, SW, SH);
                // circular room rays
                SC.save(); SC.translate(SW / 2, SH / 2);
                for (let i = 0; i < 12; i++) {
                    SC.fillStyle = `rgba(150,80,255,${0.03 + 0.01 * Math.sin(t + i)})`;
                    SC.beginPath(); SC.moveTo(0, 0);
                    SC.lineTo(Math.cos(i * Math.PI / 6 + t * 0.1) * SW, Math.sin(i * Math.PI / 6 + t * 0.1) * SH);
                    SC.lineTo(Math.cos((i + 0.2) * Math.PI / 6 + t * 0.1) * SW, Math.sin((i + 0.2) * Math.PI / 6 + t * 0.1) * SH);
                    SC.fill();
                }
                SC.restore();
                // crystal ball
                const cx2 = SW / 2, cy2 = SH * 0.42;
                const cg = SC.createRadialGradient(cx2, cy2, 0, cx2, cy2, 40);
                cg.addColorStop(0, `rgba(180,100,255,${0.7 + 0.2 * Math.sin(t * 2)})`);
                cg.addColorStop(0.5, `rgba(100,50,200,0.5)`); cg.addColorStop(1, 'transparent');
                SC.fillStyle = cg; SC.beginPath(); SC.arc(cx2, cy2, 40, 0, Math.PI * 2); SC.fill();
                SC.strokeStyle = `rgba(200,140,255,${0.4 + 0.2 * Math.sin(t * 3)})`; SC.lineWidth = 2;
                SC.beginPath(); SC.arc(cx2, cy2, 42, 0, Math.PI * 2); SC.stroke();
                // floating oracle entity
                SC.font = '28px serif'; SC.textAlign = 'center'; SC.globalAlpha = 0.6 + 0.3 * Math.sin(t * 1.5);
                SC.fillText('🔮', cx2, cy2 + 10); SC.globalAlpha = 1;
            },
            catacombs(t) {
                SC.fillStyle = '#020204'; SC.fillRect(0, 0, SW, SH);
                // skull walls
                SC.fillStyle = 'rgba(140,140,150,0.12)';
                for (let r = 0; r < 5; r++)for (let c = 0; c < 8; c++) { SC.font = '16px serif'; SC.textAlign = 'left'; SC.fillText('💀', c * (SW / 8), r * 50 + 30); }
                // ancient blade pedestal
                const bx = SW / 2, by = SH * 0.55;
                SC.fillStyle = '#0a0810'; SC.fillRect(bx - 25, by, 50, 30);
                const bg = SC.createRadialGradient(bx, by, 0, bx, by, 60);
                bg.addColorStop(0, `rgba(80,120,255,${0.4 + 0.2 * Math.sin(t * 2)})`); bg.addColorStop(1, 'transparent');
                SC.fillStyle = bg; SC.fillRect(bx - 60, by - 60, 120, 100);
                if (!S.flags.ancientWeaponTaken) drawItemFloat(bx, by - 10, '⚔️', 'rgba(80,120,255', t);
                else { SC.fillStyle = 'rgba(80,80,100,0.2)'; SC.font = '12px Cinzel,serif'; SC.textAlign = 'center'; SC.fillText('— taken —', bx, by + 10); }
            },
            throne(t) {
                SC.fillStyle = '#040108'; SC.fillRect(0, 0, SW, SH);
                // dramatic rays
                SC.save(); SC.translate(SW / 2, SH * 0.3);
                for (let i = 0; i < 12; i++) {
                    const ang = i * (Math.PI / 6) + t * 0.05;
                    SC.fillStyle = `rgba(120,20,160,${0.02 + 0.01 * Math.sin(t + i)})`;
                    SC.beginPath(); SC.moveTo(0, 0);
                    SC.lineTo(Math.cos(ang) * SW, Math.sin(ang) * SH);
                    SC.lineTo(Math.cos(ang + 0.15) * SW, Math.sin(ang + 0.15) * SH);
                    SC.fill();
                }
                SC.restore();
                // floor
                SC.fillStyle = '#03010a'; SC.fillRect(0, SH * 0.7, SW, SH * 0.3);
                SC.strokeStyle = 'rgba(60,20,80,0.3)'; SC.lineWidth = 0.5;
                for (let r = 0; r < 5; r++)for (let c = 0; c < 10; c++)SC.strokeRect(c * (SW / 10), SH * 0.7 + r * 16, SW / 10, 16);
                // throne chair
                const tx = SW / 2, ty = SH * 0.42;
                SC.fillStyle = '#180820'; SC.fillRect(tx - 36, ty, 72, SH * 0.25);
                SC.fillRect(tx - 40, ty - SH * 0.22, 80, SH * 0.22);
                SC.fillRect(tx - 50, ty - SH * 0.24, 20, SH * 0.24); SC.fillRect(tx + 30, ty - SH * 0.24, 20, SH * 0.24);
                SC.strokeStyle = 'rgba(150,60,200,0.25)'; SC.lineWidth = 2;
                SC.strokeRect(tx - 40, ty - SH * 0.22, 80, SH * 0.22);
                // throne glow
                SC.fillStyle = `rgba(120,20,160,${0.12 * flicker()})`;
                SC.beginPath(); SC.arc(tx, ty - SH * 0.1, 50, 0, Math.PI * 2); SC.fill();
                // crown
                SC.font = '22px serif'; SC.textAlign = 'center'; SC.fillStyle = `rgba(200,160,30,${0.7 + 0.15 * Math.sin(t * 2)})`;
                SC.fillText('♛', tx, ty - SH * 0.25);
                if (!S.flags.dragonDead) {
                    // dragon
                    const df = 0.7 + 0.15 * Math.sin(t * 1.8), dx = SW / 2, dy = SH * 0.42;
                    // dragon body glow
                    const drg = SC.createRadialGradient(dx, dy, 0, dx, dy, 90);
                    drg.addColorStop(0, `rgba(200,50,20,${0.2 * df})`); drg.addColorStop(1, 'transparent');
                    SC.fillStyle = drg; SC.fillRect(dx - 90, dy - 90, 180, 180);
                    // dragon silhouette layers
                    SC.fillStyle = `rgba(140,30,15,${df * 0.2})`; SC.beginPath(); SC.ellipse(dx, dy, 65, 38, 0, 0, Math.PI * 2); SC.fill();
                    SC.fillStyle = `rgba(100,20,10,${df * 0.3})`; SC.beginPath(); SC.ellipse(dx, dy + 5, 52, 28, 0, 0, Math.PI * 2); SC.fill();
                    // head
                    SC.fillStyle = `rgba(120,25,12,${df * 0.4})`; SC.beginPath(); SC.arc(dx, dy - 30, 22, 0, Math.PI * 2); SC.fill();
                    // horns
                    SC.strokeStyle = `rgba(160,40,20,${df * 0.5})`; SC.lineWidth = 2;
                    SC.beginPath(); SC.moveTo(dx - 10, dy - 45); SC.lineTo(dx - 18, dy - 68); SC.stroke();
                    SC.beginPath(); SC.moveTo(dx + 10, dy - 45); SC.lineTo(dx + 18, dy - 68); SC.stroke();
                    // EYES - intense
                    const ePulse = 0.6 + 0.4 * Math.sin(t * 3);
                    SC.fillStyle = `rgba(255,80,0,${ePulse * 0.9})`;
                    SC.beginPath(); SC.ellipse(dx - 14, dy - 32, 5, 3, 0, 0, Math.PI * 2); SC.fill();
                    SC.beginPath(); SC.ellipse(dx + 14, dy - 32, 5, 3, 0, 0, Math.PI * 2); SC.fill();
                    // eye glow
                    SC.fillStyle = `rgba(255,180,0,${ePulse * 0.5})`;
                    SC.beginPath(); SC.arc(dx - 14, dy - 32, 8, 0, Math.PI * 2); SC.fill();
                    SC.beginPath(); SC.arc(dx + 14, dy - 32, 8, 0, Math.PI * 2); SC.fill();
                    // wings
                    SC.fillStyle = `rgba(80,15,8,${df * 0.25})`;
                    SC.beginPath(); SC.moveTo(dx - 40, dy - 10); SC.quadraticCurveTo(dx - 90, dy - 60, dx - 80, dy - 10); SC.lineTo(dx - 40, dy + 5); SC.fill();
                    SC.beginPath(); SC.moveTo(dx + 40, dy - 10); SC.quadraticCurveTo(dx + 90, dy - 60, dx + 80, dy - 10); SC.lineTo(dx + 40, dy + 5); SC.fill();
                    // fire breath random
                    if (Math.sin(t * 2.3) > 0.6) {
                        const fi = Math.random();
                        SC.fillStyle = `rgba(255,${80 + fi * 100},0,${0.15 * fi})`;
                        SC.beginPath(); SC.moveTo(dx, dy - 20); SC.lineTo(dx - 60 + Math.random() * 120, dy + 50 + Math.random() * 30); SC.lineTo(dx + 15, dy - 15); SC.fill();
                    }
                } else {
                    // victory - golden sparks
                    for (let s = 0; s < 8; s++) {
                        const ang = t * 1.5 + s * Math.PI / 4, dist = 50 + Math.sin(t * 2 + s) * 20;
                        const px2 = SW / 2 + Math.cos(ang) * dist, py2 = SH * 0.5 + Math.sin(ang) * dist * 0.5;
                        SC.fillStyle = `rgba(255,200,60,${0.4 + 0.3 * Math.sin(t * 3 + s)})`;
                        SC.beginPath(); SC.arc(px2, py2, 2 + Math.sin(t * 4 + s), 0, Math.PI * 2); SC.fill();
                    }
                    drawItemFloat(SW / 2, SH * 0.68, '💎', 'rgba(255,200,50', t);
                }
                drawWallTorch(SW * 0.05, SH * 0.48, t); drawWallTorch(SW * 0.95, SH * 0.48, t);
            },
            antechamber(t) {
                SC.fillStyle = '#080208'; SC.fillRect(0, 0, SW, SH);
                // scorch marks on walls
                SC.strokeStyle = 'rgba(200,80,20,0.12)'; SC.lineWidth = 2;
                for (let i = 0; i < 8; i++) {
                    SC.beginPath(); SC.moveTo(Math.random() < 0.5 ? 0 : SW, 50 + i * 50);
                    SC.quadraticCurveTo(SW / 2 + Math.cos(i) * 100, SH * 0.4, SW / 2, SH * 0.8); SC.stroke();
                }
                // fire glow from north
                const fg = SC.createLinearGradient(0, 0, 0, SH * 0.4);
                fg.addColorStop(0, `rgba(200,80,20,${0.25 * flicker()})`); fg.addColorStop(1, 'transparent');
                SC.fillStyle = fg; SC.fillRect(0, 0, SW, SH * 0.4);
                // dragon scale item
                if (!S.flags.dragonScaleTaken) drawItemFloat(SW / 2, SH * 0.65, '🐉', 'rgba(80,120,255', t);
                drawWallTorch(SW * 0.08, SH * 0.5, t); drawWallTorch(SW * 0.92, SH * 0.5, t);
            },
            ritual(t) {
                SC.fillStyle = '#05020c'; SC.fillRect(0, 0, SW, SH);
                // circular pattern on floor
                const cx = SW / 2, cy = SH * 0.58;
                SC.strokeStyle = `rgba(180,40,220,${0.3 + 0.15 * Math.sin(t * 2)})`; SC.lineWidth = 2;
                SC.beginPath(); SC.arc(cx, cy, 80, 0, Math.PI * 2); SC.stroke();
                SC.beginPath(); SC.arc(cx, cy, 55, 0, Math.PI * 2); SC.stroke();
                // rune symbols
                const syms = ['✦', '⛧', '✦', '⛧', '✦'];
                syms.forEach((s, i) => {
                    const ang = i * (Math.PI * 2 / 5) - Math.PI / 2;
                    SC.font = '14px serif'; SC.textAlign = 'center'; SC.textBaseline = 'middle';
                    SC.fillStyle = `rgba(${S.flags.ritualSolved ? '255,200,80' : '180,40,220'},${0.6 + 0.3 * Math.sin(t * 2 + i)})`;
                    SC.fillText(s, cx + Math.cos(ang) * 80, cy + Math.sin(ang) * 80);
                });
                // candles
                for (let i = 0; i < 5; i++) {
                    const ang = i * (Math.PI * 2 / 5) - Math.PI / 2;
                    drawFlame(cx + Math.cos(ang) * 80, cy + Math.sin(ang) * 80, 6, t + i);
                }
                // rune stone glow
                if (!S.flags.runeStoneTaken) drawItemFloat(cx, cy, '💎', 'rgba(180,40,220', t);
                else if (S.flags.ritualSolved) {
                    SC.fillStyle = `rgba(255,200,80,${0.2 + 0.1 * Math.sin(t * 3)})`;
                    SC.beginPath(); SC.arc(cx, cy, 90, 0, Math.PI * 2); SC.fill();
                }
            },
            valdrosStudy(t) {
                SC.fillStyle = '#080608'; SC.fillRect(0, 0, SW, SH);
                // desk
                SC.fillStyle = '#1a0c08'; SC.fillRect(SW * 0.2, SH * 0.55, SW * 0.6, 20);
                SC.fillRect(SW * 0.25, SH * 0.75, SW * 0.1, SH * 0.25); SC.fillRect(SW * 0.65, SH * 0.75, SW * 0.1, SH * 0.25);
                // candle on desk
                drawFlame(SW / 2, SH * 0.5, 8, t);
                // portrait on wall
                SC.fillStyle = '#0c0808'; SC.fillRect(SW * 0.3, 30, SW * 0.4, 90);
                SC.strokeStyle = 'rgba(80,50,20,0.4)'; SC.lineWidth = 2; SC.strokeRect(SW * 0.3, 30, SW * 0.4, 90);
                SC.font = '32px serif'; SC.textAlign = 'center'; SC.fillStyle = 'rgba(200,160,80,0.5)';
                SC.fillText('👑🐉', SW / 2, 82);
                // journal glow
                if (!S.flags.valdrosJournalTaken) drawItemFloat(SW * 0.38, SH * 0.52, '📕', 'rgba(200,150,50', t);
                if (!S.flags.crownFragmentTaken) drawItemFloat(SW * 0.62, SH * 0.52, '👑', 'rgba(240,200,60', t);
            },
        };


        // scene render loop
        let rAF = null;
        function renderLoop(ts) {
            T = ts / 1000;
            if (SW && SH && SCENES[S.loc]) {
                SC.clearRect(0, 0, SW, SH);
                SCENES[S.loc](T);
                drawFog();
            }
            rAF = requestAnimationFrame(renderLoop);
        }

        // intro canvas
        function runIntro() {
            const cv = document.getElementById('intro-canvas');
            const cx = cv.getContext('2d');
            cv.width = window.innerWidth; cv.height = window.innerHeight;
            let pts = [];
            for (let i = 0; i < 80; i++)pts.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.2 + 0.3, s: Math.random() * 0.4 + 0.1, o: Math.random() * 0.4 + 0.1, d: (Math.random() - 0.5) * 0.3 });
            const loop2 = (ts) => {
                cx.clearRect(0, 0, cv.width, cv.height);
                pts.forEach(p => {
                    p.y -= p.s; p.x += p.d; if (p.y < 0) { p.y = cv.height; p.x = Math.random() * cv.width }
                    cx.fillStyle = `rgba(180,130,40,${p.o})`;
                    cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
                });
                requestAnimationFrame(loop2);
            };
            requestAnimationFrame(loop2);
        }

        // ═══════════════════════════════════════════════════════════
        // THE FORGOTTEN DUNGEON — EXPANDED EDITION
        // 17 Rooms | 5 Chapters | 30+ Actions | 10 Endings
        // ═══════════════════════════════════════════════════════════

        let S = {};
        function initState() {
            S = {
                loc: 'entrance', inv: [], hp: 100, maxHp: 100, score: 0, steps: 0,
                flags: {}, gameOver: false, chapter: 1,
                journal: [],
                kills: 0,
            };
        }

        // ─── MSG HELPERS ───────────────────────────────────────────
        const st = (t) => ({ type: 'story', text: t });
        const sy = (t) => ({ type: 'sys', text: t });
        const wa = (t) => ({ type: 'warn', text: t });
        const it = (t) => ({ type: 'item', text: t });
        const ht = (t) => ({ type: 'cmd', text: t });
        const sep = (t) => ({ type: 'sep', text: t });
        const ch = (t) => ({ type: 'win', text: t });  // chapter title
        const dl = (t) => ({ type: 'item', text: '💬 ' + t }); // dialogue

        function damage(n, src) {
            S.hp = Math.max(0, S.hp - n);
            updateStats(); shakeScreen(); flashRed(); playDamage();
            notif('HP -' + n + (src ? ' (' + src + ')' : ''), 'bad');
            if (S.hp <= 0 && !S.gameOver) printMsgs(gameOver('Tumhari zindagi dungeon ne le li...'));
        }
        function heal(n, src) {
            const got = Math.min(n, S.maxHp - S.hp);
            S.hp = Math.min(S.maxHp, S.hp + got);
            updateStats();
            notif('HP +' + got, 'info');
            particles(window.innerWidth / 2, window.innerHeight / 2, '#40d080', 12);
        }
        function addScore(n) { S.score += n; updateStats(); if (n > 0) notif('+' + n + ' SCORE', 'good'); }
        function addJournal(key, title, text) {
            if (S.journal.find(j => j.key === key)) return;
            S.journal.push({ key, title, text });
            addScore(5);
            notif('📖 Journal: ' + title, 'info');
        }
        function setChapter(n) {
            if (S.chapter >= n) return;
            S.chapter = n;
            notif('📜 Chapter ' + n, 'info');
        }
        // ─── WORLD MAP ─────────────────────────────────────────────
        //
        //  [CATACOMBS] ←east— [SECRET] ←north— [ALLEY] —west→ [ENTRANCE] —south→ [CRYPT] —east→ [WELL]
        //                                                           |                                  |
        //                                                         north                              south
        //                                                           |                                  |
        //  [RITUAL]  [ARMORY] ←north— [BARRACKS] ←east— [HALL] —west→ [LIBRARY] —north→ [GARDEN] ←—'
        //      |                                           |
        //    east                                        north
        //      |                                           |
        //  [STUDY] ——————————— ... ——————— [ANTECHAMBER] ←west— [THRONE] —west→ [ORACLE]
        //

        const ROOMS = {

            // ══════════════════════════════════════════════════════════
            // CHAPTER 1 — THE ARRIVAL
            // ══════════════════════════════════════════════════════════

            entrance: {
                name: 'DUNGEON ENTRANCE', short: 'Jahan har kahani shuru hoti hai...', icon: '🏚️',
                look() {
                    const items = [];
                    if (!S.flags.torchTaken) items.push('[TORCH] — lohay ki moshaal');
                    if (!S.flags.mapTaken) items.push('[OLD MAP] — chamde par bani naksha');
                    return [
                        st('Pathar ki nami deewaren. Kaai. Andar se aane waali thandi hawa.'),
                        st('Darwaze ke upar khoon se likha hai: "JO DAAKHIL HUA — WAPAS NA AAYA."'),
                        st('Neeche ek aur line — nakhunon se khurecht: "R ne try kiya. R haara. Par R ne raasta dhundha."'),
                        st('Darwaze ke paas ek SKELETON pada hai — woh bhi yahan aaya tha. Kabhi.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Darwaza saaf hai.'),
                        ht('Hint: pick up torch / pick up map | go north, south, east | examine skeleton | read inscription'),
                    ];
                },
                items: { torch: 'torchTaken', map: 'mapTaken' },
                exits: { north: 'hall', south: 'crypt', east: 'alley' },
                onEnter() {
                    if (S.flags.visitedEntrance) return [];
                    S.flags.visitedEntrance = true;
                    setChapter(1);
                    openModal();
                    addJournal('prophecy', 'The Prophecy', '"Jab chaand aur ajdaha ek hon — darwaza khulega. Sirf ek Seeker pahunch sakta hai. Sirf ek."');
                    return [
                        sep('━━━ CHAPTER 1: THE GATE OF NO RETURN ━━━'),
                        st('Saal 1347. Tumhara naam koi nahi jaanta — sirf "Seeker" ho tum.'),
                        st('Shehr ke log kehte the: "Woh dungeon mat jao. Raat ko awaazein aati hain wahan se."'),
                        st('Par prophecy ne kaha: sirf ek Seeker us khazane tak pahunch sakta hai. Sirf ek.'),
                        st('Tum aa gaye. Kyunki tumhe pata tha — yeh tumhara destiny hai.'),
                        sy('DO CHEEZEIN HAIN. SIRF EK LE SAKTE HO. YEH CHOICE TUMHARI POORI KAHANI BADLEGI!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            hall: {
                name: 'GRAND HALL', short: 'Rajao ke khambay, paintings, aur ek badi khamoshi...', icon: '🏛️',
                look() {
                    const dark = !S.flags.torchLit && !S.inv.includes('lantern');
                    if (dark) return [wa('ANDHERA! Roshni chahiye yahan. (use torch / go south)'), ht('Torch ya lantern lagao!')];
                    const items = [];
                    if (!S.flags.swordTaken) items.push('[SWORD] — stone pedestal par');
                    if (!S.flags.shieldTaken) items.push('[SHIELD] — deewaar par latkaa');
                    if (!S.flags.coinTaken) items.push('[GOLD COIN] — zameen par padi');
                    return [
                        st('Bade hall ki unchai mein torch ki lau kho jaati hai. Yahan ek bada darbar lagta tha.'),
                        st('4 PAINTINGS deewaron par: Raja Valdros — Ek dragon — Ek warrior Captain — Ek khali takht.'),
                        st('Pedestal par carved hai: "YEH TALWAAR LENE WALE KO DRAGON DEKHEGA." — Warning ya invitation?'),
                        st('Hall mein ek saans lene ki awaaz aati hai — shayad hawa. Shayad kuch aur.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Hall saaf hai.'),
                        ht('examine painting | read inscription | go north/west/south/east'),
                    ];
                },
                items: { sword: 'swordTaken', shield: 'shieldTaken', coin: 'coinTaken' },
                exits: { south: 'entrance', west: 'library', north: 'antechamber', east: 'barracks' },
                onEnter() {
                    if (S.flags.visitedHall) return [];
                    S.flags.visitedHall = true;
                    const dark = !S.flags.torchLit && !S.inv.includes('lantern');
                    if (dark) { damage(15, 'andhera'); return [sep('━━━ GRAND HALL — ANDHERA ━━━'), wa('Andhere mein girte ho — pathar se takraa gaye!'), wa('HP -15! Roshni laao. (use torch / go south)')]; }
                    addJournal('hall_inscription', 'The Warning', '"Yeh talwaar lene wale ko dragon dekhega." — Grand Hall inscription');
                    return [
                        sep('━━━ CHAPTER 1: GRAND HALL ━━━'),
                        st('Hall mein daakhil hote hi — sab kuch ruk gaya. Hawa. Awaaz. Waqt.'),
                        st('Paintings mein se ek — RAJA VALDROS — seedha tumhari taraf dekh raha hai.'),
                        st('Phir ek thandi hawa. Aur deewar par kuch chamka — ek second ke liye: "WORTHY ONE?"'),
                        sy('Shayad is dungeon mein sirf hathiyaar nahi, jawabaat bhi hain...'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            alley: {
                name: 'DARK ALLEY', short: 'Andhi gali — koi yahan kyun aaya hoga?', icon: '🌑',
                look() {
                    const items = [];
                    if (!S.flags.keyTaken) items.push('[MYSTERIOUS KEY] — chaand ka nishan');
                    if (!S.flags.noteOneTaken) items.push('[CRUMPLED NOTE] — kisi ka khat');
                    if (!S.flags.lockpickTaken) items.push('[LOCKPICK] — ek patli si wire zameen par');
                    return [
                        st('Tang gali. "HELP ME" — nakhunon se deewar par scratched.'),
                        st('Chaand ki ek patli si roshni upar se girri. Zameen par kuch chamkta hai.'),
                        st('Deewar par ek chhipi si daraar hai — kisi ne yahan kuch chhupaya tha shayad.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Gali khaali hai.'),
                        ht('pick up key | pick up note | pick up lockpick | examine wall | go west/north'),
                    ];
                },
                items: { key: 'keyTaken', note1: 'noteOneTaken', lockpick: 'lockpickTaken' },
                exits: { west: 'entrance', north: 'secret' },
                onEnter() {
                    if (S.flags.visitedAlley) return [];
                    S.flags.visitedAlley = true;
                    addJournal('alley_msg', 'A Cry for Help', '"HELP ME" — nakhunon se likha gaya. Koi yahan qaidi tha.');
                    return [
                        sep('━━━ DARK ALLEY ━━━'),
                        st('Paon rakhte hi kuch toota — ek skeleton ka haath tha zameen par.'),
                        st('Chaand ki roshni teen cheezon par padi.'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            crypt: {
                name: 'THE CRYPT', short: 'Rajao ke warriors ki qabrein, ek ghost ki awaaz...', icon: '⚰️',
                look() {
                    const items = [];
                    if (!S.flags.potionTaken) items.push('[HEALTH POTION] — altar ke paas, laal');
                    if (!S.flags.holyWaterTaken) items.push('[HOLY WATER] — ek purani vial');
                    if (!S.flags.cryptKeyTaken) items.push('[SILVER KEY] — teesri qabar ke neeche');
                    return [
                        st('7 qabrein. Pathar ki. Unpar naamein: VALDROS KE WARRIORS.'),
                        st('Teesri qabar par kuch alag hai — "RHENVAR — WHO ALMOST MADE IT."'),
                        st(S.flags.ghostTalked ? 'Ghost ne apni baat keh di. Woh ab shant hai.' : 'Ek GHOST dikh raha hai — tumhe dekh raha hai, ruka hua.'),
                        st('Ek stone ALTAR hai andar se glowing. Kisi ne yahan pooja ki thi.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Altar khaali hai.'),
                        ht('talk to ghost | pray | pick up potion | pick up holy water | search | go north/east'),
                    ];
                },
                items: { potion: 'potionTaken', holywater: 'holyWaterTaken', cryptkey: 'cryptKeyTaken' },
                exits: { north: 'entrance', east: 'well' },
                onEnter() {
                    if (S.flags.visitedCrypt) return [];
                    S.flags.visitedCrypt = true;
                    setChapter(2);
                    addJournal('rhenvar_grave', '"Almost Made It"', '"RHENVAR — WHO ALMOST MADE IT." — 300 saal purani qabar. Almost. Itna kafi nahi tha.');
                    return [
                        sep('━━━ CHAPTER 2: THE DEAD REMEMBER ━━━'),
                        st('South jaate ho — seedhi qabrein. Ek pura graveyard dungeon ke neeche.'),
                        st('Hawa ruk jaati hai. Yahan waqt alag rehta hai.'),
                        st('Ek GHOST — Captain ki uniform mein — tumhe doorr se dekh raha hai. Ruk gaya.'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            well: {
                name: 'THE ANCIENT WELL', short: 'Jadoo ka kuan — ek sachche Seeker ke liye...', icon: '🌊',
                look() {
                    const items = [];
                    if (!S.flags.ropeTaken) items.push('[ROPE] — deewar se baandha hua');
                    return [
                        st('Ek bada stone kuan. Andar se paani ki soft gurgling. Neeche ek blue glow.'),
                        st('"JO SACHCHA SEEKER HAI — YEH PAANI USE NAYI ZINDAGI DEGA." — kuan ki deewar par.'),
                        st('Kisi ne pehle yahan rope baandhi thi — neeche utarne ke liye?'),
                        S.flags.wellUsed ? sy('Kuan ka paani pi chuke ho.') : sy('[WELL] — (drink from well) — HP restore hoga'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy(''),
                        ht('drink from well | pick up rope | use rope | go west/south'),
                    ];
                },
                items: { rope: 'ropeTaken' },
                exits: { west: 'crypt', south: 'garden' },
                onEnter() {
                    if (S.flags.visitedWell) return [];
                    S.flags.visitedWell = true;
                    addJournal('well_secret', 'The Ancient Well', '"Jo sachcha Seeker hai — yeh paani use nayi zindagi dega." — kisi ne yahan barson pehle likha tha.');
                    return [
                        sep('━━━ THE ANCIENT WELL ━━━'),
                        st('Ek kamra jo sirf ek kuan ke liye bana. Paani ki awaaz... pehli baar kuch peaceful.'),
                        st('Neeche se ek neeli roshni aa rahi hai. Kuan sirf ek kuan nahi hai.'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            library: {
                name: 'ANCIENT LIBRARY', short: 'Saalon ki kitaabein, ek chhupa hua sach...', icon: '📚',
                look() {
                    const hm = S.inv.includes('map');
                    const items = [];
                    if (!S.flags.spellTaken && hm) items.push('[SPELL BOOK] — map ne guide kiya! chhipi shelf par');
                    if (!S.flags.scrollTaken) items.push('[ANCIENT SCROLL] — ek kitaab ke andar');
                    if (!S.flags.journalPageTaken) items.push('[TORN PAGE] — zameen par padi, purani');
                    return [
                        st('Hazaron kitaabein. Dhool. Khamoshi. Par ek zinda feel.'),
                        st('Title visible: "DRAGONS: WEAKNESS" | "KING VALDROS: THE CURSE" | "ESCAPE FROM DEATH"'),
                        st('"THE RITUAL CIRCLE" — ek aur book hai kone mein, red cover.'),
                        hm ? it('MAP ka X nishan is shelf ki taraf! Kuch hidden hai yahan!') : wa('Map hota toh kuch dhundh lete — kuch chhupa lagta hai...'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Library dhundh chuke ho.'),
                        ht('pick up spellbook | pick up scroll | pick up page | read books | search | go east/north'),
                    ];
                },
                items: { spellbook: 'spellTaken', scroll: 'scrollTaken', journalpage: 'journalPageTaken' },
                exits: { east: 'hall', north: 'garden', west: 'ritual' },
                onEnter() {
                    if (S.flags.visitedLibrary) return [];
                    S.flags.visitedLibrary = true;
                    if (S.inv.includes('map')) {
                        addScore(50);
                        addJournal('map_secret', 'Map\'s Secret', 'Map ka X nishan library ki ek secret shelf ki taraf tha. Kisi ne pehle se jaanta tha.');
                        return [
                            sep('━━━ ANCIENT LIBRARY ━━━'),
                            st('Map ka X nishan ek purani shelf ki taraf. Haath ust dhool bhari spine par gaya...'),
                            it('"DRACONIS INFERNUM" — SPELL BOOK MILI! Dragon ko control karne ka mantra!'),
                            sy('SCORE +50! Map ne raaz khola!'),
                        ];
                    }
                    return [
                        sep('━━━ ANCIENT LIBRARY ━━━'),
                        st('Kitaabein. Saalon ki khamoshi. Kuch chhupa hai — par bina guide ke haath andha hai.'),
                        st('Ek kitaab shelf se giri — "DRAGONS: WEAKNESS". Shayad koi chahta hai tum padho?'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            secret: {
                name: 'SECRET CHAMBER', short: 'Saalon se band — waqt yahan ruk gaya...', icon: '🔐',
                look() {
                    const items = [];
                    if (!S.flags.amuletTaken) items.push('[FIRE AMULET] — deewar par latkaa, glowing');
                    return [
                        st('Ek chhota bund kamra. Saalon ki band hawa — musty, bhaari.'),
                        st('Beech mein LOCKED CHEST — sone ki jaali, chaand ka nishan, ek bada taala.'),
                        st('"SIRF CHAAND KI CHABI WALA IS KHAZANE KA HAQDAR HAI." — deewar par khudaa.'),
                        S.flags.chestOpen
                            ? sy('Chest khul chuka hai. Rhenvar ka note tha andar.')
                            : sy(S.inv.includes('key') || S.inv.includes('cryptkey') || S.inv.includes('lockpick')
                                ? '[LOCKED CHEST] — khol sakte ho! (open chest)' : '[LOCKED CHEST] — key / lockpick chahiye.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy(''),
                        ht('open chest | pick up amulet | read inscription | go south/east'),
                    ];
                },
                items: { amulet: 'amuletTaken' },
                exits: { south: 'alley', east: 'catacombs' },
                onEnter() {
                    if (S.flags.visitedSecret) return [];
                    S.flags.visitedSecret = true;
                    addJournal('secret_chamber', 'Secret Chamber', '"Sirf chaand ki chabi wala is khazane ka haqdar hai." — Secret Chamber.');
                    return [
                        sep('━━━ SECRET CHAMBER ━━━'),
                        st('Key ghumayi — CLICK. Pehli baar khula. Saalon ki band hawa ek jhatke mein aayi.'),
                        st('Andar — chest, amulet, aur ek aur raasta jo aur gehre le jaata hai.'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            garden: {
                name: 'UNDERGROUND GARDEN', short: 'Roshni — dungeon ke andar?', icon: '🌿',
                look() {
                    const items = [];
                    if (!S.flags.herbTaken) items.push('[HEALING HERB] — neeli, chamakdar');
                    if (!S.flags.poisonHerbTaken) items.push('[POISON HERB] — laal, khatarnaak');
                    if (!S.flags.seedsTaken) items.push('[MAGIC SEEDS] — ek pot mein rakhe, glowing');
                    return [
                        st('Dungeon ke andar ek garden — bioluminescent plants neele aur laal rang mein chamak rahi hain.'),
                        st('Hawa ke bina bhi yeh hil rahi hain. Koi invisible force inhe touch kar raha hai.'),
                        st('Pin kiya hua note: "NEELI HERB HEALS — LAAL HERB ZEHER. DRAGON KO BHI." — Kisi ka haath.'),
                        st('Ek aur note: "SEEDS PLUS WELL WATER EQUALS ANTIDOTE." — mysterious.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Garden explore kar chuke ho.'),
                        ht('pick up herb | pick up poison herb | pick up seeds | examine plants | go north/east'),
                    ];
                },
                items: { herb: 'herbTaken', poisonherb: 'poisonHerbTaken', seeds: 'seedsTaken' },
                exits: { north: 'well', east: 'library' },
                onEnter() {
                    if (S.flags.visitedGarden) return [];
                    S.flags.visitedGarden = true;
                    addScore(20);
                    addJournal('garden_note', 'The Garden Note', '"Neeli herb heals — laal herb zeher. Dragon ko bhi." + "Seeds + well water = antidote." — Kisi ka chhupa hua knowledge.');
                    return [
                        sep('━━━ UNDERGROUND GARDEN ━━━'),
                        st('YEH KYA? Dungeon ke andar ek garden — glowing plants se bhara!'),
                        st('Kisi ne inhe carefully plant kiya tha. Koi tha jo yahan rehta tha. Raja Valdros khud?'),
                        sy('SCORE +20 — hidden garden mila!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            barracks: {
                name: 'OLD BARRACKS', short: 'Fauji sipahiyon ka dera, ab sirf ek guard...', icon: '⚔️',
                look() {
                    const items = [];
                    if (!S.flags.lanternTaken) items.push('[LANTERN] — table par rakhi');
                    if (!S.flags.rationsTaken) items.push('[RATIONS] — ek purana tin box, food hai');
                    return [
                        st('Purane fauji bistar. Tooti kursiyan. Zaraat ki badboo. Ek army rehti thi yahan.'),
                        st('Kone mein SKELETON GUARD — poori uniform mein, aankhein tere taraf.'),
                        !S.flags.skeletonDefeated
                            ? wa('"TURN BACK OR FACE DEATH, SEEKER!" — woh raasta rok raha hai north ki taraf.')
                            : sy('Skeleton guard shant hai. Raasta saaf.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy(''),
                        ht('fight skeleton | bribe skeleton | talk to skeleton | use holy water | pick up lantern | go west/north'),
                    ];
                },
                items: { lantern: 'lanternTaken', rations: 'rationsTaken' },
                exits: { west: 'hall', north: 'armory' },
                onEnter() {
                    if (S.flags.visitedBarracks) return [];
                    S.flags.visitedBarracks = true;
                    return [
                        sep('━━━ OLD BARRACKS ━━━'),
                        st('Hall ke east mein ek purani chawni. Valdros ke warriors rehte the yahan.'),
                        st('Tab... khadkane ki awaaz. Ek skeleton — poori fauji uniform mein — uth khada hua.'),
                        wa('"INTRUDER! YEH FAUJ KA ILAQA HAI!" — Guard taiyaar hai.'),
                        sy('Tum lad sakte ho, bribe kar sakte ho, baat kar sakte ho, ya holy water use kar sakte ho!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            armory: {
                name: 'ROYAL ARMORY', short: 'Raja ki personal hathiyaar — ab bhi taiyaar...', icon: '🛡️',
                look() {
                    const items = [];
                    if (!S.flags.armorTaken) items.push('[CHAINMAIL ARMOR] — bhaari par bulletproof');
                    if (!S.flags.poisondaggerTaken) items.push('[POISON DAGGER] — laal zeher se bhiga');
                    if (!S.flags.throwingKnivesTaken) items.push('[THROWING KNIVES] — 3 knives, ek wooden box mein');
                    return [
                        st('Raja Valdros ki personal armory. Hathiyaar purane hain par itne mazboot.'),
                        st('EK PORTRAIT: "CAPTAIN RHENVAR — MARTYRED. HIS SACRIFICE LIT THE WAY."'),
                        st('Rhenvar ne dragon se ladai ki thi. Haara — par usne dragon ko wound kiya. Ek taraf. Left wing.'),
                        st('Ek note armory ke andar: "JISNE BHI YEH PADHA — POISON DAGGER LEFT WING PAR. SIRF WAHAN."'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Armory khaali hai.'),
                        ht('pick up armor | pick up poison dagger | pick up throwing knives | examine portrait | go south'),
                    ];
                },
                items: { armor: 'armorTaken', poisondagger: 'poisondaggerTaken', throwingknives: 'throwingKnivesTaken' },
                exits: { south: 'barracks' },
                onEnter() {
                    if (S.flags.visitedArmory) return [];
                    S.flags.visitedArmory = true;
                    addScore(30);
                    addJournal('rhenvar_note', 'Rhenvar\'s Final Note', '"Jisne bhi yeh padha — poison dagger left wing par. Sirf wahan. Woh place he can\'t protect." — Captain Rhenvar');
                    return [
                        sep('━━━ ROYAL ARMORY ━━━'),
                        st('Armory mein lohe aur khoon ki boo. Yahan se jo bhi warrior nikla — vijeta ya shaheed.'),
                        st('Portrait mein Rhenvar ki aankhein — determined. Woh jaanta tha woh marega.'),
                        sy('SCORE +30 — Armory mila!'),
                    ];
                },
            },

            // ══════════════════════════════════════════════════════════
            // CHAPTER 3 — THE DEEPER DARK
            // ══════════════════════════════════════════════════════════

            catacombs: {
                name: 'CATACOMBS', short: 'Dungeon ki gehraai — yahan sirf worthy jaata hai...', icon: '💀',
                look() {
                    const items = [];
                    if (!S.flags.ancientWeaponTaken) items.push('[ANCIENT BLADE] — neeli roshni mein, pedestal par');
                    if (!S.flags.cryptScrollTaken) items.push('[CRYPT SCROLL] — ek skull ke andar rakha');
                    return [
                        st('Hazaron skulls hain. Qabrein nahi — sirf skulls. Floor se ceiling tak.'),
                        st('"YEH BLADE SIRF US KE LIYE HAI JO SACH MEIN WORTHY HAI." — stone slab par.'),
                        st('Blade ek pedestal par rakhi hai — neeli roshni mein chamak rahi hai.'),
                        st('Ek skull ki aankhein glowing hain — woh tumhare movements follow kar raha hai...'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy(''),
                        ht('pick up ancient blade | pick up crypt scroll | examine skull | go west'),
                    ];
                },
                items: { ancientblade: 'ancientWeaponTaken', cryptscroll: 'cryptScrollTaken' },
                exits: { west: 'secret' },
                onEnter() {
                    if (S.flags.visitedCatacombs) return [];
                    S.flags.visitedCatacombs = true;
                    addScore(50);
                    setChapter(3);
                    addJournal('catacombs_secret', 'The Worthy Blade', '"Yeh blade sirf us ke liye hai jo sach mein worthy hai." — Kisi ne yahan likha aur chala gaya.');
                    return [
                        sep('━━━ CHAPTER 3: THE WORTHY ONE ━━━'),
                        st('Neeche jaate ho. Roshni khatam. Sirf tumhari torch / lantern.'),
                        st('Phir... ek NEELI chamak. Pedestal par ek blade — purani. Legendary.'),
                        st('Jaise hi tumne qadam rakha — skulls ki aankhein tumse mili.'),
                        sy('SCORE +50 — Deepest secret mila!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            ritual: {
                name: 'RITUAL CIRCLE', short: 'Ek qadiim pooja ki jagah — ab bhi active...', icon: '🔮',
                look() {
                    const items = [];
                    if (!S.flags.runeStoneTaken) items.push('[RUNE STONE] — circle ke beech, glowing');
                    if (!S.flags.candlesTaken) items.push('[BLACK CANDLES] — 5 candles, arranged perfectly');
                    return [
                        st('Library ke west mein ek gol kamra. Zameen par ek bada circular pattern — runes mein bana.'),
                        st('Pattern abhi bhi faintly glowing hai. Kisi ne yahan ek bahut purana ritual kiya tha.'),
                        st('Beech mein ek RUNE STONE rakha hai — usse uthane se kya hoga?'),
                        st(S.flags.ritualSolved ? 'Ritual complete ho chuka hai — dragon kamzor hua!' : '"TEEN RUNES MEIN SE EK CHUNO — TEESRA DRAGON KA NAAM HAI." — deewar par likha.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Ritual circle khaali hai.'),
                        ht('pick up rune stone | examine circle | solve ritual | go east'),
                    ];
                },
                items: { runestone: 'runeStoneTaken', candles: 'candlesTaken' },
                exits: { east: 'library', north: 'valdrosStudy' },
                onEnter() {
                    if (S.flags.visitedRitual) return [];
                    S.flags.visitedRitual = true;
                    addScore(35);
                    addJournal('ritual_hint', 'The Ritual Circle', '"Teen runes mein se ek chuno — teesra dragon ka naam hai." — Kisi ne yahan likha. Teen: VALDROS. INFERNUM. RHENVAR. Kaun sa dragon ka naam hai?');
                    return [
                        sep('━━━ RITUAL CIRCLE ━━━'),
                        st('Library ki west wall pe ek chhipi door thi. Yeh kamra kisi map mein nahi tha.'),
                        st('Zameen par glowing runes — koi jadoo yahin se kiya gaya tha.'),
                        sy('SCORE +35 — Hidden ritual room mila!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            oracle: {
                name: "ORACLE'S CHAMBER", short: '300 saalon se ek awaaz intezaar kar rahi thi...', icon: '🔮',
                look() {
                    return [
                        st('Ek gol kamra — beech mein ek glowing crystal ball. Hawa mein ek aurat ki awaaz.'),
                        st('"TUM AAYE. PROPHECY NE SACH KAHA." — 3 baar echo hoti hai.'),
                        !S.flags.oracleTalked
                            ? sy('Oracle se baat karo — dragon ka raaz jaanti hai! (talk to oracle)')
                            : sy('Oracle se baat ho chuki hai. Woh tumhare sath hai.'),
                        !S.flags.visionSeen && S.inv.includes('scroll')
                            ? sy('"Scroll Oracle ke saamne rakh do" — (use scroll)') : sy(''),
                        !S.flags.visionSeen && S.inv.includes('runestone')
                            ? sy('"Rune Stone Oracle ko do" — (use rune stone)') : sy(''),
                        ht('talk to oracle | use scroll | use rune stone | go east'),
                    ];
                },
                items: {},
                exits: { east: 'throne' },
                onEnter() {
                    if (S.flags.visitedOracle) return [];
                    S.flags.visitedOracle = true;
                    addScore(40);
                    setChapter(4);
                    addJournal('oracle_prophecy', 'Oracle\'s Vision', '"300 saalon mein pehli baar koi is dungeon ke gehraai tak pahuncha. Prophecy sach hua." — Oracle');
                    return [
                        sep('━━━ CHAPTER 4: THE ORACLE SPEAKS ━━━'),
                        st('Throne room ke west mein ek chhipi darwaza thi — tumne dhakela aur woh khuli.'),
                        st('EK ROSHAN KAMRA. Crystal ball. Aur ek purani awaaz...'),
                        st('"AAKHIR AAYE TUM. 300 SAAL SE KISI KA INTEZAAR THA YAHAN."'),
                        sy('SCORE +40 — Oracle mili!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            antechamber: {
                name: 'DRAGON\'S ANTECHAMBER', short: 'Yahan se dragon ki saans sun sakte ho...', icon: '🔥',
                look() {
                    const items = [];
                    if (!S.flags.dragonScaleTaken) items.push('[DRAGON SCALE] — zameen par padi, blue');
                    return [
                        st('Ek bada kamra throne room se pehle. Deewaron par scorch marks — dragon ki aag ki nishaaniyaan.'),
                        st('Hawa mein dhuaan hai. Aur ek bhaari saans ki awaaz — andar se.'),
                        st('Zameen par kuch hai — ek BLUE SCALE. Kisi aur ne yahan laddai ki thi.'),
                        st(S.flags.companion ? '"Seeker — yahan dhyan se. Dragon ko pata chal jaayega." — Ghost companion whispered.' : ''),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy(''),
                        ht('pick up dragon scale | examine scorch marks | go south/east/north(throne)'),
                    ];
                },
                items: { dragonscale: 'dragonScaleTaken' },
                exits: { south: 'hall', east: 'oracle', north: 'throne' },
                onEnter() {
                    if (S.flags.visitedAntechamber) return [];
                    S.flags.visitedAntechamber = true;
                    addScore(25);
                    addJournal('antechamber', 'Before The Dragon', '"Aage dragon hai. Woh sunta hai. Woh mahsoos karta hai. Taiyaar raho." — Scorch marks ki kahani.');
                    return [
                        sep('━━━ DRAGON\'S ANTECHAMBER ━━━'),
                        st('Hall ke north mein ek bada gate hai. Aur uske paas... saans ki awaaz.'),
                        st('DRAGON YAHAN HAI. Throne room mein. Ek door ki doori.'),
                        st('Zameen par ek blue scale padi hai — dragon ka ek piece.'),
                        sy('SCORE +25 — Antechamber mila!'),
                    ];
                },
            },

            // ──────────────────────────────────────────────────────────
            valdrosStudy: {
                name: "VALDROS'S STUDY", short: 'Raja ka personal kamra — saalon se bund...', icon: '📜',
                look() {
                    const items = [];
                    if (!S.flags.valdrosJournalTaken) items.push('[VALDROS JOURNAL] — uski personal diary');
                    if (!S.flags.crownFragmentTaken) items.push('[CROWN FRAGMENT] — ek tooti taaj ka hissa');
                    return [
                        st('Ek chhota, personal kamra. Ek desk. Ek chair. Ek half-burned portrait.'),
                        st('Portrait mein ek aadmi aur ek dragon — dono ek saath. Dono... dost?'),
                        st('"MAIN NE HI YEH DRAGON BANAYA. APNI MAUT KE BAAD KHAZANE KI RAKHWAALI KE LIYE. MUJHE MAAFI." — desk par likha.'),
                        items.length ? sy('Items: ' + items.join(' | ')) : sy('Study explore kar chuke ho.'),
                        ht('pick up journal | pick up crown fragment | examine portrait | read desk | go west'),
                    ];
                },
                items: { valdrosjournal: 'valdrosJournalTaken', crownfragment: 'crownFragmentTaken' },
                exits: { west: 'ritual' },
                onEnter() {
                    if (S.flags.visitedStudy) return [];
                    S.flags.visitedStudy = true; addScore(60);
                    setChapter(3);
                    addJournal('valdros_confession', 'Valdros\'s Confession', '"Main ne hi yeh dragon banaya. Apni maut ke baad khazane ki rakhwaali ke liye. Mujhe maafi." — Raja Valdros ki personal diary.');
                    return [
                        sep('━━━ VALDROS\'S STUDY ━━━'),
                        st('Ritual room ke east mein ek bahut chhipi door thi — ek bookshelf ke peeche.'),
                        st('Raja Valdros ka personal kamra. Kisi ko pata nahi tha yeh tha.'),
                        st('Desk par ek khulli diary — aakhri page par ek confession.'),
                        sy('SCORE +60 — Biggest secret mila! Valdros khud hi dragon ka creator tha!'),
                    ];
                },
                },

            // ══════════════════════════════════════════════════════════
            // CHAPTER 5 — THE FINAL CONFRONTATION
            // ══════════════════════════════════════════════════════════

            throne: {
                name: 'THRONE ROOM', short: 'Aakhiri imtihaan — yeh woh jagah hai...', icon: '👑',
                look() {
                    const hw = S.inv.includes('sword') || S.inv.includes('spellbook') || S.inv.includes('poisondagger') || S.inv.includes('ancientblade');
                    const ha = S.inv.includes('shield') || S.inv.includes('armor');
                    const am = S.inv.includes('amulet');
                    const sc = S.inv.includes('scroll') || S.inv.includes('cryptscroll') || S.flags.visionSeen || S.flags.oracleTalked;
                    const pd = S.inv.includes('poisondagger');
                    const ab = S.inv.includes('ancientblade');
                    const ds = S.inv.includes('dragonscale');
                    if (S.flags.dragonDead) return [
                        st('Dragon ki raakh hawa mein ude ja rahi hai. Throne khaali. Khamoshi.'),
                        st('Throne ke peeche — ek GOLDEN CHEST — dungeon ka asli khazana.'),
                        !S.flags.treasureTaken ? sy('[GOLDEN CHEST] — (take treasure)') : sy('Khazana le chuke ho!'),
                        ht('take treasure | examine throne | search | go south/west'),
                    ];
                    let weaponLine = '';
                    if (ab) weaponLine = '⚔️ ANCIENT BLADE (legendary!)';
                    else if (S.inv.includes('spellbook')) weaponLine = '📖 SPELL BOOK (magic!)';
                    else if (pd) weaponLine = '🗡️ POISON DAGGER (stealth!)';
                    else if (S.inv.includes('sword')) weaponLine = '⚔️ SWORD';
                    else weaponLine = '❌ Koi weapon nahi!';
                    return [
                        st('DRAGON! Throne par baitha — purana, vishal, aankhein angar ki tarah.'),
                        st('Tumhari awaaz suni toh uthne laga — wings phaile, muh se dhuaan.'),
                        st('"AAKHIR AAYE TUM. KITNE SAALON BAAD EK INSAAN NE YAHAN QADAM RAKHA."'),
                        st('Dragon... baat kar raha hai. Human language mein.'),
                        sy(`Weapon: ${weaponLine} | Armor: ${ha ? '✓' : '✗'} | Amulet: ${am ? '✓' : '✗'} | Weak point: ${sc ? 'KNOWN' : 'UNKNOWN'}`),
                        ht('fight dragon | sneak attack | talk to dragon | throw knives | use poison herb | go south/west'),
                    ];
                },
                items: {},
                exits: { south: 'antechamber', west: 'oracle' },
                onEnter() {
                    if (S.flags.visitedThrone) return [];
                    S.flags.visitedThrone = true;
                    setChapter(5);
                    const hw = S.inv.includes('sword') || S.inv.includes('spellbook') || S.inv.includes('poisondagger') || S.inv.includes('ancientblade');
                    const ha = S.inv.includes('shield') || S.inv.includes('armor');
                    if (!hw) {
                        damage(40, 'dragon surprise attack'); playDragon();
                        return [sep('━━━ CHAPTER 5: THE DRAGON AWAKES ━━━'),
                        wa('RAAAAR! Dragon ne bina warning attack kiya!'),
                        wa('HP -40 — bina weapon ke aaye! Jaldi jao south!'),
                        ];
                    }
                    playDragon();
                    const intro = S.flags.oracleTalked || S.flags.visionSeen || S.inv.includes('scroll') || S.inv.includes('cryptscroll')
                        ? 'Tumhe pata hai: LEFT WING ke neeche BLUE SCALE — wahi weak point hai.'
                        : 'Dragon ke baare mein tumhe zyada pata nahi. Sirf itna — yeh bahut bada hai.';
                    addJournal('dragon_meeting', 'The Dragon Speaks', '"Aakhir aaye tum. Kitne saalon baad ek insaan ne yahan qadam rakha." — Dragon ne khud bola.');
                    return [
                        sep('━━━ CHAPTER 5: FACE TO FACE ━━━'),
                        st('Gate khulte hi — aag ki laat. Bhaap. Aur phir... WOH.'),
                        st('DRAGON. Throne par baitha. Aankhon mein aag ka dariya. Wings phaile.'),
                        st('"AAKHIR AAYE TUM." — Dragon ne human language mein kaha.'),
                        st('"Main thak gaya hoon 300 saalon se. Par yeh curse — main tod nahi sakta."'),
                        st(intro),
                        sy('Options: fight dragon | sneak attack | talk to dragon | throw knives | use poison herb'),
                    ];
                },
            },

        }; // end ROOMS

        // ═══════════════════════════════════════════════════════════
        // PICKUP STORIES — expanded
        // ═══════════════════════════════════════════════════════════
        const PICKUPS = {
            torch: { msgs: [it('🔦 TORCH UTHAAI!'), st('Tar mein aag lagate ho — lau chamki, andhera hata.'), sy('Torch jali!'), wa('NOTE: Map nahi liya — Library secrets miss ho sakti hain!')], fx() { S.flags.torchLit = true; addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#f0a500', 20); playTorchLight(); } },
            map: { msgs: [it('🗺️ OLD MAP UTHAYA!'), st('3 X nishan — teen chhipi jagahon ke hints!'), sy('Map liya! Library ka Spell Book + Ritual Room + Garden milenge.'), wa('NOTE: Torch nahi li — andheri jagahon mein HP loss!')], fx() { addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#4088cc', 20); } },
            sword: { msgs: [it('⚔️ RUSTY SWORD UTHAAI!'), st('"YEH TALWAAR LENE WALE KO DRAGON DEKHEGA." — Ab samjhe kyun.'), sy('SWORD equipped! (fight dragon)')], fx() { addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#c0d0e0', 15); } },
            shield: { msgs: [it('🛡️ IRON SHIELD UTHAAI!'), st('Captain Rhenvar ki thi yeh. Dragon ka damage 40% kam hoga.'), sy('SHIELD equipped!')], fx() { addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#6090c0', 15); } },
            key: { msgs: [it('🗝️ MYSTERIOUS KEY MILI!'), st('Chaand ka nishan. Sirf ek jagah fit hogi.'), sy('KEY liya! (go north = secret chamber)')], fx() { addScore(20); particles(window.innerWidth / 2, window.innerHeight / 2, '#c8a040', 15); playItemMagic(); } },
            note1: { msgs: [it('📜 CRUMPLED NOTE MILA!'), st('"Oracle se milo — throne ke west. Woh sab jaanti hai." — R'), sy('R = Captain Rhenvar. (hall→north→north→west)')], fx() { addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#80c0ff', 10); } },
            lockpick: { msgs: [it('🔧 LOCKPICK MILA!'), st('Ek patli wire — professional ka aujaaar.'), sy('LOCKPICK! Key ke bina bhi chest khol sakte ho. (open chest)')], fx() { addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#c0c0c0', 10); } },
            coin: { msgs: [it('🪙 GOLD COIN MILI!'), st('Valdros ka chehra — 300 saal purana sikka.'), sy('GOLD COIN! Skeleton ko bribe karo. (bribe skeleton)')], fx() { addScore(5); particles(window.innerWidth / 2, window.innerHeight / 2, '#f0c040', 8); } },
            potion: { msgs: [it('🧪 HEALTH POTION MILI!'), st('Laal, chamakdar. Dungeon ki purani recipe.'), sy('(use potion) — HP +40')], fx() { addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#ff4444', 15); } },
            holywater: { msgs: [it('💧 HOLY WATER MILI!'), st('Roshan, paak vial — undead creatures darte hain.'), sy('(use holy water in barracks) — Skeleton instant defeat')], fx() { addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#80d0ff', 10); playItemMagic(); } },
            cryptkey: { msgs: [it('🗝️ SILVER KEY MILI!'), st('Rhenvar ne teesri qabar ke neeche chhipi thi.'), sy('SILVER KEY — Secret Chamber bhi kholti hai!')], fx() { addScore(25); particles(window.innerWidth / 2, window.innerHeight / 2, '#d0d0ff', 15); playItemMagic(); } },
            rope: { msgs: [it('🪢 ROPE MILA!'), st('Mazboot, lambi. Well mein kaam aayegi.'), sy('(use rope in well) — hidden chamber milega')], fx() { addScore(5); particles(window.innerWidth / 2, window.innerHeight / 2, '#a08040', 8); } },
            herb: { msgs: [it('🌿 HEALING HERB MILI!'), st('Neeli roshni mein chamakti. HP instantly recover.'), sy('(eat herb) — HP +20')], fx() { addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#40d080', 10); } },
            poisonherb: { msgs: [it('☠️ POISON HERB MILI!'), st('"LAAL HERB ZEHER — DRAGON KO BHI." Garden ka note.'), sy('(use poison herb in throne room) — Dragon instant defeat')], fx() { addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#cc2020', 10); } },
            seeds: { msgs: [it('🌱 MAGIC SEEDS MILE!'), st('"Seeds + well water = antidote." — Garden note.'), sy('(use seeds in well) — Antidote banta hai!')], fx() { addScore(10); particles(window.innerWidth / 2, window.innerHeight / 2, '#40c040', 10); } },
            lantern: { msgs: [it('🏮 LANTERN MILA!'), st('Torch se zyada roshan, hawa mein nahi bujhta.'), sy('LANTERN equipped! Behtar roshni.')], fx() { S.flags.torchLit = true; addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#ffcc40', 12); playTorchLight(); } },
            rations: { msgs: [it('🍖 RATIONS MILI!'), st('Purana tin box — surprisingly ok.'), sy('(eat rations) — HP +15')], fx() { addScore(5); particles(window.innerWidth / 2, window.innerHeight / 2, '#c08040', 8); } },
            armor: { msgs: [it('🛡️ CHAINMAIL ARMOR PEHNA!'), st('Captain Rhenvar ka armor — dragon ki talwaar bhi rokta hai.'), sy('ARMOR equipped! Dragon ka damage 60% kam. Shield se behtar!')], fx() { addScore(25); particles(window.innerWidth / 2, window.innerHeight / 2, '#8090a0', 15); } },
            poisondagger: { msgs: [it('🗡️ POISON DAGGER MILI!'), st('"SIRF LEFT WING." — Rhenvar ka note yaad hai?'), sy('(sneak attack in throne) — Dragon instant defeat!')], fx() { addScore(25); particles(window.innerWidth / 2, window.innerHeight / 2, '#804000', 15); playItemMagic(); } },
            throwingknives: { msgs: [it('🗡️ THROWING KNIVES MILE!'), st('3 chhuri — nimble, sharp. Ranged attack.'), sy('(throw knives in throne) — Ranged attack!')], fx() { addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#a0a0c0', 12); } },
            amulet: { msgs: [it('🔮 FIRE AMULET MILA!'), st('Dragon ki aag se bachane ke liye — shayad Rhenvar ka.'), sy('FIRE AMULET! Dragon ki aag 70% protection.')], fx() { addScore(20); particles(window.innerWidth / 2, window.innerHeight / 2, '#ff8030', 15); playItemMagic(); } },
            scroll: { msgs: [it('📜 ANCIENT SCROLL MILA!'), st('"Dragon ka weak point: LEFT WING ke neeche, BLUE SCALE."'), sy('SCROLL! Oracle ya fight mein use karo.')], fx() { addScore(15); particles(window.innerWidth / 2, window.innerHeight / 2, '#c0a0ff', 12); playItemMagic(); } },
            journalpage: { msgs: [it('📄 TORN PAGE MILI!'), st('"...Valdros ne dragon banaya... Rhenvar ko pata tha..."'), sy('Story ka ek piece. (journal) mein dekho.')], fx() { addScore(8); addJournal('torn_page', 'Torn Journal Page', '"Valdros ne Aethon ko slave banaya. Rhenvar ko pata tha." — Torn page.'); particles(window.innerWidth / 2, window.innerHeight / 2, '#c0e0ff', 8); } },
            runestone: { msgs: [it('💎 RUNE STONE MILA!'), st('"INFERNUM" — Dragon ka naam rune mein!'), sy('RUNE STONE! Oracle ya ritual circle mein use karo.')], fx() { addScore(20); particles(window.innerWidth / 2, window.innerHeight / 2, '#ff40ff', 15); playItemMagic(); } },
            candles: { msgs: [it('🕯️ BLACK CANDLES MILE!'), st('5 candles — ritual pattern mein rakhi thi.'), sy('CANDLES! Ritual solve karne mein kaam aayengi.')], fx() { addScore(8); particles(window.innerWidth / 2, window.innerHeight / 2, '#404040', 8); } },
            dragonscale: { msgs: [it('🐉 DRAGON SCALE MILI!'), st('BLUE scale — left wing se. Yahi weak point hai!'), sy('Dragon scale — weak point confirm! Fight mein advantage.')], fx() { S.flags.visionSeen = true; addScore(20); particles(window.innerWidth / 2, window.innerHeight / 2, '#4080ff', 15); playItemMagic(); } },
            cryptscroll: { msgs: [it('📜 CRYPT SCROLL MILI!'), st('"Dragon ka naam AETHON hai. DRACONIS INFERNUM spell se free karo."'), sy('CRYPT SCROLL — Full dragon history!')], fx() { addScore(30); particles(window.innerWidth / 2, window.innerHeight / 2, '#8080ff', 20); playItemMagic(); } },
            valdrosjournal: { msgs: [it('📕 VALDROS JOURNAL MILA!'), st('"Maine Aethon ko slave banaya — mera purana dost. Mujhe maafi." — Valdros'), sy('JOURNAL! Sari kahani saamne aa gayi. Valdros ki confession.')], fx() { addScore(50); addJournal('valdros_full', 'Valdros\'s Confession', '"Maine Aethon ko banaya. Mera dost. Ab slave hai 300 saalon se. Use free karo." — Raja Valdros'); particles(window.innerWidth / 2, window.innerHeight / 2, '#f0c060', 40); playItemMagic(); } },
            crownfragment: { msgs: [it('👑 CROWN FRAGMENT MILA!'), st('Tooti taaj — khud hi glow kar raha hai. Kuch jadoo hai.'), sy('CROWN FRAGMENT! (place crown in throne room after dragon) — True ending!')], fx() { addScore(30); particles(window.innerWidth / 2, window.innerHeight / 2, '#f0d060', 20); playItemMagic(); } },
            ancientblade: { msgs: [it('⚔️ ANCIENT BLADE!!!'), st('"WORTHY ONE." — Blade uthate hi pedestal se awaaz aayi.'), sy('ANCIENT BLADE — Legendary! Dragon ko 2x damage. Sabse powerful!')], fx() { addScore(60); particles(window.innerWidth / 2, window.innerHeight / 2, '#4080ff', 40); playItemMagic(); } },
        };

        // SPECIAL ACTIONS
        // ═══════════════════════════════════════════════════════════

        // ── TALK TO NPC ──────────────────────────────────────────
        function talkTo(target) {
            const t = target.toLowerCase().trim();

            // Ghost (Rhenvar) in crypt
            if ((t === 'ghost' || t === 'bhoot' || t === 'rhenvar') && S.loc === 'crypt') {
                if (S.flags.ghostTalked) return [dl('"Jao, Seeker. Tumhara raasta saaf hai. Mera ashirwaad tumhare saath."')];
                S.flags.ghostTalked = true; addScore(25);
                addJournal('ghost_rhenvar', 'Ghost of Rhenvar', '"Main Captain Rhenvar tha. 300 saal is dungeon mein hoon. Dragon ek curse hai — Valdros ne khud banaya. Oracle se milo."');
                return [sep('━━━ GHOST OF CAPTAIN RHENVAR ━━━'),
                dl('"Main... Raja Valdros ka Captain tha. Rhenvar. Main 300 saal se yahan hoon."'),
                dl('"Dragon ek zaroori burai nahi hai — woh ek CURSE hai. Valdros ne khud banaya apni maut ke baad."'),
                dl('"Ek AETHON naam ka dragon tha — Valdros ka dost. Ab woh slave hai. 300 saal se."'),
                dl('"Meri armory mein poison dagger hai. Oracle se milo — throne ke west mein."'),
                dl('"Aur... study room hai — ritual room ke east mein. Valdros ki diary wahan hai."'),
                sy('SCORE +25! Ghost se crucial info mili! Companion unlock hua!'),
                sy('Map update: Armory (hall→east→north) | Oracle (throne→west) | Study (ritual→east)'),
                ];
            }

            // Oracle
            if ((t === 'oracle' || t.includes('oracle')) && S.loc === 'oracle') {
                if (S.flags.oracleTalked) return [dl('"Jo keh diya — keh diya. Tum worthy ho, Seeker. Jao."')];
                S.flags.oracleTalked = true; addScore(30);
                addJournal('oracle_truth', 'Oracle\'s Truth', '"Dragon ka naam Aethon hai. Valdros ka slave. Free karne ka tarika: DRACONIS INFERNUM ya Ancient Blade ya Poison Dagger. Left wing blue scale."');
                const hasJournal = S.inv.includes('valdrosjournal');
                return [sep('━━━ ORACLE BOLI ━━━'),
                dl('"SEEKER. 300 saalon mein pehla insaan jo yahan tak pahuncha."'),
                dl('"Dragon ka naam AETHON hai. Woh Valdros ka slave hai — criminal nahi."'),
                dl(hasJournal
                    ? '"Tumne Valdros ki diary padhi — toh tum sach jaante ho. Dragon ko free karo ya defeat karo."'
                    : '"Dragon ko free karne ka tarika: DRACONIS INFERNUM — spell book mein hai."'),
                dl('"Ya ancient blade — catacombs mein. Ya poison dagger — left wing par, armory mein."'),
                dl('"Weak point: LEFT WING, BLUE SCALE. Rhenvar ne wahan strike kiya tha."'),
                sy('SCORE +30! Complete guidance mili!'),
                ];
            }

            // Dragon
            if ((t === 'dragon' || t === 'aethon' || t.includes('dragon')) && S.loc === 'throne') {
                if (S.flags.dragonDead) return [wa('Dragon ab nahi raha...')];
                if (S.flags.dragonTalked2) {
                    addScore(10);
                    return [sep('━━━ AETHON BOLA ━━━'),
                    dl('"Tum abhi bhi yahan ho? Jaldi karo — mera curse toot nahi raha. Main rok nahi sakta khud ko zyada der."'),
                    dl('"Spell book, ancient blade, ya poison dagger — sirf teen tarikey hain. USE THEM."'),
                    ];
                }
                S.flags.dragonTalked2 = true; addScore(20);
                addJournal('aethon_speaks', 'Dragon Speaks', '"Mera naam Aethon hai. Main Valdros ka dost tha. Ab slave hoon 300 saalon se. Mujhe free karo ya maar do — par please jaldi karo."');
                const knowsName = S.inv.includes('valdrosjournal') || S.inv.includes('cryptscroll');
                return [sep('━━━ AETHON SPEAKS ━━━'),
                dl(knowsName
                    ? '"Tum ne Valdros ki diary padhi. Toh tum sach jaante ho. Main Aethon hoon."'
                    : '"SEEKER... Mera naam Aethon hai. Main Valdros ka DOST tha. Phir woh mara. Aur maine woh sab bhool diya jo tha."'),
                dl('"Yeh curse... main tod nahi sakta khud. Saalon se try kiya. 300 saal."'),
                dl('"Ek hi tarika hai: DRACONIS INFERNUM — ya Ancient Blade — ya Poison Dagger left wing par."'),
                dl('"Mujhe free karo ya maar do. Par please — jaldi karo. Main thak gaya hoon."'),
                sy('SCORE +20! Dragon ki full backstory mili! Yeh ek victim hai.'),
                ];
            }

            // Skeleton Guard
            if ((t === 'skeleton' || t === 'guard' || t === 'skeleton guard') && S.loc === 'barracks') {
                if (S.flags.skeletonDefeated) return [dl('"Tumne mujhe free kiya. Shukriya, Seeker."')];
                if (S.flags.skeletonTalked) {
                    return [dl('"Main kehna dohraoon: fight karo, bribe karo gold coin se, ya holy water use karo."')];
                }
                S.flags.skeletonTalked = true;
                return [sep('━━━ SKELETON GUARD ━━━'),
                dl('"SEEKER. Main Captain Rhenvar ka haath tha. Meri duty hai raasta rokna."'),
                dl('"Par... main thak gaya hoon. 300 saal ki duty. Ek minute ki rest nahi."'),
                dl('"Agar tum worthy ho — toh aage jao. Mujhe convince karo ya lad lo."'),
                dl('"Ya... agar tumhare paas holy water hai — mujhe finally chain de sakte ho."'),
                sy('Options: fight skeleton | bribe skeleton (gold coin) | use holy water'),
                ];
            }

            // Valdros ghost (only after reading journal)
            if ((t === 'valdros' || t === 'raja') && S.flags.valdrosJournalTaken) {
                if (!S.flags.valdrosGhostTalked) {
                    S.flags.valdrosGhostTalked = true; addScore(35);
                    addJournal('valdros_ghost', 'Valdros\'s Ghost', '"Seeker — meri galti sudhar do. Aethon ko free karo. Use maar doge toh bhi theek hai — maut bhi ek azaadi hai." — Ghost of Valdros');
                    return [sep('━━━ GHOST OF VALDROS ━━━'),
                    dl('"Seeker... tum ne meri diary padhi. Tum sab jaante ho."'),
                    dl('"Main ne Aethon ko slave banaya. 300 saal. Woh mera dost tha."'),
                    dl('"Mujhe maafi nahi chahiye — bas meri galti sudhar do."'),
                    dl('"Aethon ko free karo. Use maar doge toh bhi theek hai — maut bhi ek azaadi hai."'),
                    sy('SCORE +35! Valdros ki ghost mili — rare event!'),
                    ];
                }
                return [dl('"Jao, Seeker. Jo karna hai karo. Mera waqt poora hua."')];
            }

            return [wa('"' + target + '" se baat nahi kar sakte yahan.')];
        }

        // ── USE ITEM ─────────────────────────────────────────────
        function useItem(item) {
            const it2 = item.toLowerCase().trim();

            // Potion
            if (it2 === 'potion' || it2 === 'health potion') {
                if (!S.inv.includes('potion')) return [wa('Potion nahi hai.')];
                if (S.hp >= S.maxHp) return [sy('HP full hai!')];
                const h = Math.min(40, S.maxHp - S.hp); heal(h, 'potion');
                S.inv.splice(S.inv.indexOf('potion'), 1); updateInv();
                return [it(`🧪 POTION! HP +${h}!`), sy(`HP: ${S.hp}/${S.maxHp}`)];
            }

            // Eat herb
            if (it2 === 'herb' || it2 === 'healing herb' || it2 === 'eat herb' || it2 === 'neeli herb') {
                if (!S.inv.includes('herb')) return [wa('Healing herb nahi hai.')];
                const h = Math.min(20, S.maxHp - S.hp); heal(h, 'herb');
                S.inv.splice(S.inv.indexOf('herb'), 1); updateInv();
                return [it(`🌿 HERB! HP +${h}!`), sy(`HP: ${S.hp}/${S.maxHp}`)];
            }

            // Eat rations
            if (it2 === 'rations' || it2 === 'eat rations' || it2 === 'food') {
                if (!S.inv.includes('rations')) return [wa('Rations nahi hain.')];
                const h = Math.min(15, S.maxHp - S.hp); heal(h, 'rations');
                S.inv.splice(S.inv.indexOf('rations'), 1); updateInv();
                return [it(`🍖 RATIONS! HP +${h}!`), sy(`HP: ${S.hp}/${S.maxHp}`)];
            }

            // Holy water on skeleton
            if ((it2 === 'holy water' || it2 === 'holywater') && S.loc === 'barracks') {
                if (!S.inv.includes('holywater')) return [wa('Holy water nahi hai.')];
                if (S.flags.skeletonDefeated) return [sy('Skeleton pehle se defeat hai.')];
                S.flags.skeletonDefeated = true;
                S.inv.splice(S.inv.indexOf('holywater'), 1); updateInv();
                addScore(35); particles(window.innerWidth / 2, window.innerHeight / 2, '#80d0ff', 20);
                return [sep('━━━ HOLY WATER ━━━'),
                it('💧 HOLY WATER USE KI!'),
                st('Vial toda — skeleton par phenka. Ek roshni mein naha gaya woh.'),
                dl('"Shukriya... Seeker. 300 saal baad... chain mila." — Skeleton slowly baith gaya.'),
                sy('SCORE +35! Skeleton peacefully defeated! (go north = armory)'),
                ];
            }

            // Poison herb on dragon
            if ((it2 === 'poison herb' || it2 === 'poisonherb' || it2 === 'laal herb') && S.loc === 'throne' && !S.flags.dragonDead) {
                if (!S.inv.includes('poisonherb')) return [wa('Poison herb nahi hai.')];
                S.flags.dragonDead = true; S.kills++;
                S.inv.splice(S.inv.indexOf('poisonherb'), 1); updateInv();
                addScore(75); setTimeout(() => startBGM('throne_clear'), 2500);
                particles(window.innerWidth / 2, window.innerHeight / 2, '#cc2020', 40);
                return [sep('━━━ POISON ATTACK! ━━━'),
                st('Dragon ke paani mein poison herb milate ho jab woh jhuka tha...'),
                st('Ek second ruka. Phir ek badi cheekh.'),
                it('☠️ DRAGON POISONED! Strategic victory!'),
                sy('SCORE +75! Agle: take treasure'),
                ];
            }

            // Use scroll in oracle or fight
            if (it2 === 'scroll' || it2 === 'ancient scroll') {
                if (!S.inv.includes('scroll') && !S.inv.includes('cryptscroll')) return [wa('Scroll nahi hai.')];
                if (S.loc === 'oracle' && !S.flags.visionSeen) {
                    S.flags.visionSeen = true; addScore(25);
                    return [st('Scroll crystal ball ke paas rakha. Ek vision:'),
                    it('🔮 VISION: Dragon ka left wing — ek BLUE SCALE — "YAHAN STRIKE KARO"!'),
                    sy('SCORE +25! Exact weak point pata chal gaya!'),
                    ];
                }
                if (S.loc === 'throne' && !S.flags.dragonDead) {
                    S.flags.visionSeen = true;
                    return [st('Scroll padh ke weak point yaad kiya: LEFT WING, BLUE SCALE.'), sy('Ab fight dragon karo!')];
                }
                return [st('"Dragon ka weak point: left wing blue scale." — scroll content.')];
            }

            // Use rune stone at oracle or ritual
            if (it2 === 'rune stone' || it2 === 'runestone') {
                if (!S.inv.includes('runestone')) return [wa('Rune stone nahi hai.')];
                if (S.loc === 'oracle') {
                    S.flags.visionSeen = true; addScore(30);
                    return [st('Rune stone crystal ball ke paas rakha — INFERNUM rune chamki!'),
                    it('🔮 Rune Oracle ko: Dragon ka curse INFERNUM pe based hai. Spell Book is word use karti hai!'),
                    sy('SCORE +30! Rune stone ne oracle ko activate kiya!'),
                    ];
                }
                if (S.loc === 'ritual') {
                    return solveRitual();
                }
                return [sy('Rune stone oracle ya ritual circle mein use karo.')];
            }

            // Use crown fragment on throne
            if ((it2 === 'crown fragment' || it2 === 'crown') && S.loc === 'throne') {
                if (!S.inv.includes('crownfragment')) return [wa('Crown fragment nahi hai.')];
                if (!S.flags.dragonDead) return [wa('Pehle dragon se nipato!')];
                if (S.flags.crownPlaced) return [sy('Crown pehle rakh chuke ho.')];
                S.flags.crownPlaced = true; addScore(50);
                particles(window.innerWidth / 2, window.innerHeight / 2, '#f0d060', 30);
                return [sep('━━━ THE CROWN ━━━'),
                st('Throne par crown fragment rakhte ho. Ek warm golden light phailti hai.'),
                it('👑 VALDROS KI AATMA SHANT HUI! Crown ne uska curse toda!'),
                st('"Shukriya, Seeker... meri galti sudhar di tumne... Aethon aur main... ab free hain..." — Valdros ki awaaz.'),
                sy('SCORE +50! True ending condition complete! (take treasure)'),
                ];
            }

            // Use rope in well
            if (it2 === 'rope' && S.loc === 'well') {
                if (!S.inv.includes('rope')) return [wa('Rope nahi hai.')];
                addScore(20);
                return [st('Rope kuan mein laataakte ho — neeche utarte ho...'),
                st('Ek hidden chamber! Aur usme ek inscription:'),
                it('"JO WELL KA RAAZ JAANE — WAHI DUNGEON SE ZINDA NIKLE. VALDROS."'),
                sy('SCORE +20! Hidden well secret mila!'),
                ];
            }

            // Use seeds in well (antidote)
            if ((it2 === 'seeds' || it2 === 'magic seeds') && S.loc === 'well') {
                if (!S.inv.includes('seeds')) return [wa('Seeds nahi hain.')];
                S.inv.splice(S.inv.indexOf('seeds'), 1);
                S.inv.push('antidote'); updateInv();
                addScore(30); particles(window.innerWidth / 2, window.innerHeight / 2, '#80ff80', 15);
                return [sep('━━━ ANTIDOTE BANA! ━━━'),
                it('⚗️ ANTIDOTE TAIYAAR! Seeds + well water combine hue!'),
                sy('ANTIDOTE — dungeon ke kisi bhi zeher ya trap se protect karega! +10 HP per battle.')];
            }

            // Use torch/lantern
            if (it2 === 'torch' || it2 === 'lantern') {
                if (S.flags.torchLit) return [sy('Roshni pehle se hai.')];
                if (!S.inv.includes(it2)) return [wa(`${it2.toUpperCase()} nahi hai.`)];
                S.flags.torchLit = true; playTorchLight();
                particles(window.innerWidth / 2, window.innerHeight / 2, '#f0a040', 10);
                return [it(`🔥 ${it2.toUpperCase()} JALA!`), st('Andhera peechhe hata gaya. Dungeon zinda ho gayi.')];
            }

            return [wa('"' + item + '" yahan use nahi ho sakta.')];
        }

        // ── SOLVE RITUAL ─────────────────────────────────────────
        function solveRitual() {
            if (S.loc !== 'ritual') return [wa('Ritual circle yahan nahi hai. (go west from library)')];
            if (S.flags.ritualSolved) return [sy('Ritual pehle complete ho gaya.')];

            const hasRune = S.inv.includes('runestone');
            const hasCandles = S.inv.includes('candles');
            const knowsName = S.inv.includes('valdrosjournal') || S.inv.includes('cryptscroll');

            if (!knowsName) return [
                wa('Ritual solve karne ke liye dragon ka naam jaanna chahiye.'),
                sy('Hint: Valdros study mein journal hai, ya catacombs mein scroll. (ritual circle mein teen options: VALDROS / INFERNUM / RHENVAR — teesra dragon ka naam hai)')
            ];

            S.flags.ritualSolved = true; addScore(60);
            if (hasRune) S.inv.splice(S.inv.indexOf('runestone'), 1);
            if (hasCandles) S.inv.splice(S.inv.indexOf('candles'), 1);
            updateInv();
            particles(window.innerWidth / 2, window.innerHeight / 2, '#ff40ff', 40);

            return [sep('━━━ RITUAL COMPLETE! ━━━'),
            st('"INFERNUM!" — Dragon ka naam circle mein likhte ho. Runes chamak uthin.'),
            st('Ek badi roshan laat. Phir khamoshi.'),
            it('🔮 RITUAL SOLVED! Dragon ka armor weak ho gaya — fight mein 50% extra damage!'),
            sy('SCORE +60! Ritual ka effect: fight dragon mein bonus milega!')
            ];
        }

        // ── EXAMINE ──────────────────────────────────────────────
        function examineTarget(target) {
            const t = target.toLowerCase();
            if (t === 'skeleton' || t === 'bones' || t === 'body') {
                if (S.loc === 'entrance') return [st('Ek purana skeleton — explorer ki clothes. Pocket mein kuch nahi. Woh bhi khali haath aaya tha. Tumse pehle.')];
                if (S.loc === 'barracks') return [st('Skeleton guard — poori uniform. Captain ka badge. Aankhon mein ek thaka hua glow. 300 saalon ki thakaan.')];
                if (S.loc === 'crypt') return [st('7 qabrein. Sab warriors. "RHENVAR — WHO ALMOST MADE IT." Teesri qabar. Almost ne hi kaafi nahi kiya.')];
                return [wa('Koi skeleton nahi yahan.')];
            }
            if (t === 'painting' || t === 'paintings' || t === 'portrait') {
                if (S.loc === 'hall') return [
                    st('4 paintings. PAINTING 1: Raja Valdros tahkt par — crown, scepter, ek intelligent chehra.'),
                    st('PAINTING 2: Ek dragon — neele aankhon wala. Naam likha hai neeche: "AETHON."'),
                    st('PAINTING 3: Warriors lad rahe hain — ek captain, dragon ke saamne. Poison dagger haath mein.'),
                    st('PAINTING 4: Khali takht. Ek golden chest. Ek chhota figure jo haath utha ke khada hai — Prophecy?'),
                ];
                if (S.loc === 'armory') return [st('"CAPTAIN RHENVAR — MARTYRED." Ek determined warrior, poison dagger haath mein, dragon ke saamne. Woh haara — par usne raasta dikhaya.')];
                if (S.loc === 'valdrosStudy' || S.loc === 'study') return [st('Ek aadmi aur ek dragon — dono ek saath. Dono khush dikh rahe hain. Neeche likha: "VALDROS & AETHON — FRIENDS BEFORE THE CURSE."')];
                return [wa('Koi painting nahi yahan.')];
            }
            if (t === 'throne' || t === 'takht') {
                if (S.loc === 'throne' && S.flags.dragonDead) {
                    return [st('Stone throne. "VALDROS REX" carved hai. Armrest par ek glow: "WORTHY ONE — TAKE WHAT IS YOURS."'), sy('take treasure')];
                }
                if (S.loc === 'throne') return [wa('Throne tak pahunchne ke liye dragon se pehle nibatna hoga!')];
                return [wa('Throne yahan nahi.')];
            }
            if (t === 'circle' || t === 'runes' || t === 'pattern') {
                if (S.loc === 'ritual') return [
                    st('Zameen par ek bada circular pattern — runes mein. 3 rune groups: "VALDROS" "INFERNUM" "RHENVAR"'),
                    st('"TEEN RUNES MEIN SE EK CHUNO — TEESRA DRAGON KA NAAM HAI." — deewar par.'),
                    sy(S.flags.ritualSolved ? 'Ritual complete hai.' : 'Dragon ka naam jaanna chahiye. (solve ritual — type exactly: solve ritual)'),
                ];
                return [wa('Ritual circle yahan nahi.')];
            }
            if (t === 'chest') {
                if (S.loc === 'secret') return [st('Bada chest, sone ki jaali, chaand ka nishan. Ek bada taala. Key ya lockpick chahiye.')];
                if (S.loc === 'throne' && S.flags.dragonDead) return [st('GOLDEN CHEST — sunehri roshni. Dungeon ka asli khazana.')];
                return [wa('Koi chest nahi.')];
            }
            if (t === 'well' || t === 'kuan') {
                if (S.loc === 'well') return [st('Neeche ek blue glow — kuan magic source hai. Rope se neeche utar sakte ho. Ya seedha pi sakte ho.')];
                return [wa('Kuan yahan nahi.')];
            }
            if (t === 'scorch marks' || t === 'burn marks') {
                if (S.loc === 'antechamber') return [st('Deewaron par scorch marks — dragon ki aag ki nishaaniyaan. Patterns se lagta hai yahan kaafi battles hue hain. Ek mark pe carved hai: "RHENVAR WAS HERE."')];
                return [wa('Scorch marks yahan nahi.')];
            }
            if (t === 'plants' || t === 'herbs' || t === 'flowers') {
                if (S.loc === 'garden') return [st('Neele plants heal karte hain — laal zeher dete hain. Dragon ko bhi. Pin kiya note: "Seeds + well water = antidote."')];
                return [wa('Plants yahan nahi.')];
            }
            if (t === 'skull' || t === 'skulls') {
                if (S.loc === 'catacombs') {
                    addScore(5);
                    return [st('Ek skull ki aankhein glowing hain — tumhe follow kar raha hai. Phir... ek click. Ek hidden drawer khula!'),
                    it('🔍 Hidden drawer! Ek puraana coin aur ek crumpled note: "WORTHY BLADE IS REAL. TAKE IT."'),
                    sy('SCORE +5 — hidden secret mila!')];
                }
                return [wa('Skulls yahan nahi.')];
            }
            if (t === 'desk' || t === 'table') {
                if (S.loc === 'valdrosStudy') {
                    return [st('"MAIN NE HI YEH DRAGON BANAYA. APNI MAUT KE BAAD. MUJHE MAAFI." — Desk par Valdros ka last message.'),
                    sy('Valdros journal bhi hai yahan agar nahi liya. (pick up journal)')];
                }
                return [wa('Desk yahan nahi.')];
            }
            return [wa('"' + target + '" examine nahi ho sakta.')];
        }

        // ── READ ─────────────────────────────────────────────────
        function readThing(target) {
            const t = target.toLowerCase();
            if (t === 'note' || t === 'crumpled note' || t === 'khat') {
                if (!S.inv.includes('note1')) return [wa('Note nahi hai.')];
                return [st('"Agar tum yeh padh rahe ho — Oracle se milo. Throne ke west. Woh sab jaanti hai." — R'),
                sy('R = Captain Rhenvar. Ghost crypt mein hai (entrance→south).')];
            }
            if (t === 'scroll' || t === 'ancient scroll') {
                if (!S.inv.includes('scroll') && !S.inv.includes('cryptscroll')) return [wa('Scroll nahi hai.')];
                if (S.inv.includes('cryptscroll')) return [
                    st('"Dragon aur Valdros ek hi sath bune the. Dragon ka naam AETHON hai."'),
                    st('"Dragon ko free karne ka tarika: uska asli naam lo: DRACONIS INFERNUM spell mein."'),
                ];
                return [st('"Dragon ka weak point: LEFT WING ke neeche, BLUE SCALE. Ek precise strike karo wahan."')];
            }
            if (t === 'inscription' || t === 'writing' || t === 'wall') {
                const ins = {
                    entrance: '"JO DAAKHIL HUA — WAPAS NA AAYA." | Aur: "R ne try kiya. R haara. Par R ne raasta dhundha."',
                    hall: '"YEH TALWAAR LENE WALE KO DRAGON DEKHEGA." | Pedestal: "VALDROS KA KHAZANA SIRF WORTHY KA."',
                    alley: '"HELP ME" — nakhunon se scratched. Kisi prisoner ka.',
                    crypt: '"WAPAS AANE WALON KE LIYE — ALTAR PAR KUCH CHHODA." | "RHENVAR — WHO ALMOST MADE IT."',
                    well: '"JO SACHCHA SEEKER HAI — YEH PAANI USE NAYI ZINDAGI DEGA."',
                    secret: '"SIRF CHAAND KI CHABI WALA IS KHAZANE KA HAQDAR HAI."',
                    armory: '"CHAINMAIL DEFEATS THE FLAME. POISON ENDS THE CURSE." — Captain Rhenvar',
                    ritual: '"TEEN RUNES MEIN SE EK CHUNO — TEESRA DRAGON KA NAAM HAI." | 3 options: VALDROS / INFERNUM / RHENVAR',
                    antechamber: '"RHENVAR WAS HERE." — ek scorch mark par. Ek aur: "LEFT WING. BLUE SCALE. JUST ONCE."',
                };
                const msg = ins[S.loc];
                return msg ? [st(msg)] : [wa('Koi inscription nahi yahan.')];
            }
            if (t === 'book' || t === 'books') {
                if (S.loc !== 'library') return [wa('Yahan kitaabein nahi.')];
                return [
                    st('"DRAGONS: WEAKNESS" — "Dragon ek zaroori burai nahi — woh ek bind kiya hua soul hai. Sirf ek cheez free kar sakti hai: Draconis Infernum ya uski maut."'),
                    st('"KING VALDROS: THE CURSE" — "Valdros ne apne dost Aethon ko slave banaya. Regret se bhar gaya tha woh marne se pehle."'),
                    st('"THE RITUAL CIRCLE" — "Dungeon ki ritual room mein dragon ka naam likhne se uska curse kamzor pad jaata hai."'),
                ];
            }
            if (t === 'journal' || t === 'valdros journal' || t === 'diary') {
                if (!S.inv.includes('valdrosjournal')) return [wa('Valdros journal nahi hai. (study room mein hai — ritual→east)')];
                return [
                    st('"Diary Entry, Day 1 of Death: Main mar gaya hoon. Par mera khazana abhi bhi dungeon mein hai."'),
                    st('"Mujhe darr tha koi use churaa lega. Toh maine Aethon — mera purana dost — ko use kiya."'),
                    st('"Maine usse SLAVE banaya. Curse daal diya. Woh agree nahi tha. Par mere paas power tha."'),
                    st('"300 saal baad — agar koi yeh padh raha hai — mujhe maafi. Aethon ko free karo."'),
                ];
            }
            return [wa('"' + target + '" padha nahi ja sakta.')];
        }

        // ── SEARCH ───────────────────────────────────────────────
        function searchRoom() {
            const loc = S.loc;
            if (loc === 'entrance' && !S.flags.searchedEntrance) {
                S.flags.searchedEntrance = true;
                if (!S.flags.coinTaken) {
                    S.flags.coinTaken = true; S.inv.push('coin'); updateInv(); addScore(5);
                    return [it('🔍 DARWAZE KI DARAARON MEIN: GOLD COIN chhipi thi!'), sy('SCORE +5')];
                }
                return [st('Entrance carefully search kiya — darwaze mein ek crack hai. Kuch nahi zyada.')];
            }
            if (loc === 'library' && !S.flags.searchedLibrary) {
                S.flags.searchedLibrary = true;
                if (!S.flags.scrollTaken) {
                    S.flags.scrollTaken = true; S.inv.push('scroll'); updateInv(); addScore(15);
                    return [it('🔍 LIBRARY SEARCH: ANCIENT SCROLL ek kitaab ke andar chhipi thi!'), sy('SCORE +15')];
                }
                return [st('Library search ki — scroll pehle le chuke ho.')];
            }
            if (loc === 'crypt' && !S.flags.searchedCrypt) {
                S.flags.searchedCrypt = true;
                if (!S.flags.cryptKeyTaken) {
                    S.flags.cryptKeyTaken = true; S.inv.push('cryptkey'); updateInv(); addScore(25);
                    return [it('🔍 RHENVAR KI QABAR: SILVER KEY neeche chhipi thi!'), sy('SCORE +25 — alternate key mila!')];
                }
                return [st('Crypt search ki. Teesri qabar: "RHENVAR — WHO ALMOST MADE IT." Almost.')];
            }
            if (loc === 'well' && !S.flags.searchedWell) {
                S.flags.searchedWell = true; addScore(10);
                return [st('Well ke paas ek chhipi ledge hai — kisi ne yahan ek message chhoda:'),
                it('"JO PAANI PEETA HAI SACHCHI NIYAT SE — DRAGON USSE NAHI MAARTA." — Koi Seeker pehle se tha?'),
                sy('SCORE +10')];
            }
            if (loc === 'barracks' && !S.flags.searchedBarracks) {
                S.flags.searchedBarracks = true; addScore(8);
                if (!S.flags.rationsTaken) {
                    S.flags.rationsTaken = true; S.inv.push('rations'); updateInv();
                    return [it('🔍 BARRACKS: Ek purana tin box — RATIONS hain andar!'), sy('SCORE +8')];
                }
                return [st('Barracks search ki. Ek purana letter mila: "Agla mission: Dungeon. Warriors, wapas aana." — Commander. Woh wapas nahi aaye.')];
            }
            if (loc === 'throne' && S.flags.dragonDead && !S.flags.searchedThrone) {
                S.flags.searchedThrone = true; addScore(30);
                return [it('🔍 THRONE MEIN HIDDEN DRAWER! Ek chhipi jagah — Valdros ka personal note:'),
                st('"Dear Seeker — Tum jo dhundh rahe ho woh sirf khazana nahi. Asli khazana is dungeon ki kahani hai. — Valdros"'),
                sy('SCORE +30!')];
            }
            return [st('Is room ko dhyan se search kiya — abhi kuch khaas nahi mila.')];
        }

        // ── DRINK / PRAY ─────────────────────────────────────────
        function drinkWell() {
            if (S.loc !== 'well') return [wa('Kuan yahan nahi.')];
            if (S.flags.wellUsed) return [sy('Pehle pi chuke ho.')];
            S.flags.wellUsed = true;
            const h = Math.min(35, S.maxHp - S.hp); heal(h, 'well');
            addScore(10);
            return [it(`💧 KUAN SE PIYA! HP +${h}!`),
            st('Thanda, crystal clear. Ek nayi energy.'),
            sy(`HP: ${S.hp}/${S.maxHp}. SCORE +10`)];
        }

        function prayAction() {
            if (S.loc !== 'crypt') return [wa('Prayer ki jagah yahan nahi.')];
            if (S.flags.prayedCrypt) return [sy('Pehle pray kar chuke ho.')];
            S.flags.prayedCrypt = true; addScore(15);
            const h = Math.min(20, S.maxHp - S.hp); heal(h, 'blessing');
            return [it('🙏 ALTAR PAR BLESSED!'),
            st('Altar ke saamne ghutne teke. Ek warm light.'),
            dl('"Tum worthy ho, Seeker. Jao — mera ashirwaad tumhare saath." — Ghost Rhenvar'),
            sy(`HP +${h}! SCORE +15`)];
        }

        // ── SKELETON COMBAT ──────────────────────────────────────
        function fightSkeleton() {
            if (S.loc !== 'barracks') return [wa('Koi skeleton nahi yahan.')];
            if (S.flags.skeletonDefeated) return [sy('Skeleton pehle se defeat hai.')];
            S.flags.skeletonDefeated = true; S.kills++;
            const dmg = S.inv.includes('armor') || S.inv.includes('shield') ? 12 : 22;
            damage(dmg, 'skeleton fight'); addScore(20);
            particles(window.innerWidth / 2, window.innerHeight / 2, '#c0c8d0', 20); playSwordSwing();
            return [sep('━━━ SKELETON FIGHT! ━━━'),
            st('Skeleton ne talwaar uthaai — tum bhi taiyaar!'),
            st('Ek fierce fight — skeleton bhaari par tum agile.'),
            wa(`HP -${dmg} fight mein!`),
            dl('"...Achha kiya. Mujhe maaro. Ab chain milega." — Skeleton'),
            sy('SCORE +20! Armory raasta khula. (go north)'),
            ];
        }

        function bribeSkeleton() {
            if (S.loc !== 'barracks') return [wa('Skeleton yahan nahi.')];
            if (S.flags.skeletonDefeated) return [sy('Skeleton pehle pass ho gaya.')];
            if (!S.inv.includes('coin')) return [wa('Gold coin nahi hai! (entrance search se mila, ya hall mein pada hai)')];
            S.flags.skeletonDefeated = true;
            S.inv.splice(S.inv.indexOf('coin'), 1); updateInv(); addScore(15);
            return [sep('━━━ BRIBE! ━━━'),
            st('Gold coin skeleton ke saamne pakde.'),
            dl('"...Valdros ka coin. 300 saal purana." — Skeleton ki aankhein dim huin. "Theek hai. Aage jao."'),
            sy('SCORE +15! Bloodless victory! (go north = armory)'),
            ];
        }

        // ── THROW KNIVES ─────────────────────────────────────────
        function throwKnives() {
            if (S.loc !== 'throne') return [wa('Throwing knives yahan kaam nahi aayengi.')];
            if (S.flags.dragonDead) return [sy('Dragon pehle se mar gaya.')];
            if (!S.inv.includes('throwingknives')) return [wa('Throwing knives nahi hain. (armory mein uthao)')];
            if (S.flags.knivesThrown) return [wa('Saari knives phenk chuke ho already.')];

            S.flags.knivesThrown = true;
            const hasScroll = S.flags.visionSeen || S.flags.oracleTalked || S.inv.includes('scroll');
            S.inv.splice(S.inv.indexOf('throwingknives'), 1); updateInv();

            if (hasScroll) {
                S.flags.dragonDead = true; addScore(80); S.kills++;
                setTimeout(() => startBGM('throne_clear'), 2000);
                particles(window.innerWidth / 2, window.innerHeight / 2, '#a0a0c0', 30); playSwordSwing();
                return [sep('━━━ THROWING KNIVES — PRECISION! ━━━'),
                st('Weak point pata tha: LEFT WING, BLUE SCALE.'),
                st('Teen knives — ek ek karke. Pehli dono miss. TEESRI — BLUE SCALE PAR!'),
                it('🎯 DRAGON DEFEATED! Precision kill!'),
                sy('SCORE +80! take treasure'),
                ];
            }
            damage(20, 'dragon counterattack');
            return [sep('━━━ THROWING KNIVES ━━━'),
            st('Teen knives phenki — dragon ne side step kiya. Ek knife lagi — par dragon aur gussa hua!'),
            wa('HP -20! Knives se zyada nahi hua. Weak point jaanna chahiye tha. (oracle/scroll)'),
            sy('Knives khatam. Ab sword/spellbook/poison dagger use karo. (fight dragon)'),
            ];
        }

        // ── SNEAK ATTACK ─────────────────────────────────────────
        function sneakAttack() {
            if (S.loc !== 'throne') return [wa('Sneak attack yahan nahi ho sakta.')];
            if (S.flags.dragonDead) return [sy('Dragon pehle se maar diya.')];
            const hasDagger = S.inv.includes('poisondagger');
            const hasAncient = S.inv.includes('ancientblade');
            const hasScroll = S.flags.visionSeen || S.flags.oracleTalked || S.inv.includes('scroll') || S.inv.includes('cryptscroll');
            if (!hasDagger && !hasAncient) return [wa('Sneak attack ke liye poison dagger ya ancient blade chahiye!')];
            if (!hasScroll) return [wa('Weak point nahi pata! Oracle ya scroll — pehle information lo!')];

            S.flags.dragonDead = true; S.kills++;
            const weapon = hasAncient ? 'Ancient Blade' : 'Poison Dagger';
            const score = hasAncient ? 130 : 100;
            addScore(score);
            setTimeout(() => startBGM('throne_clear'), 1500);
            particles(window.innerWidth / 2, window.innerHeight / 2, '#4080ff', 60);
            playSwordSwing(); setTimeout(playSwordHit, 300);

            const ritualBonus = S.flags.ritualSolved ? ' + Ritual ka curse weakening bonus!' : '';
            return [sep('━━━ PERFECT SNEAK ATTACK! ━━━'),
            st('Dragon ki nazar dusri taraf — tum dheere dheere left wing ki taraf gaye.'),
            st(`BLUE SCALE dikh gayi! ${weapon} se ek PRECISE STRIKE!${ritualBonus}`),
            st('"...Shukriya, Seeker..." — Aethon ki last words.'),
            it(`⚔️ PERFECT KILL! ${weapon.toUpperCase()}!`),
            sy(`SCORE +${score}! Stealth victory! take treasure`),
            ];
        }

        // ── FIGHT DRAGON — Main Battle ───────────────────────────
        function fightDragon() {
            if (S.loc !== 'throne') return [wa('Dragon yahan nahi.')];
            if (S.flags.dragonDead) return [sy('Dragon pehle maar diya.')];
            const hs = S.inv.includes('spellbook');
            const sw = S.inv.includes('sword');
            const ab = S.inv.includes('ancientblade');
            const ha = S.inv.includes('shield') || S.inv.includes('armor');
            const am = S.inv.includes('amulet');
            const sc = S.flags.visionSeen || S.flags.oracleTalked || S.inv.includes('scroll') || S.inv.includes('cryptscroll');
            const ritual = S.flags.ritualSolved;
            const anti = S.inv.includes('antidote');
            if (!hs && !sw && !ab) return [wa('Koi weapon nahi! sword/spellbook/ancient blade lao.')];

            let msgs = [sep('━━━ DRAGON BATTLE! ━━━')];
            playDragon(); S.flags.dragonFoughtFrontally = true; S.kills++;

            // Calculate damage
            let dmg = am && ha ? 5 : ha ? 18 : am ? 10 : 32;
            if (anti) dmg = Math.max(0, dmg - 10);
            if (ritual) dmg = Math.max(0, dmg - 8);

            // Score
            let bonus = (sc ? 20 : 0) + (am ? 15 : 0) + (ha ? 10 : 0) + (ritual ? 25 : 0);

            if (ab) {
                msgs.push(st('Ancient Blade chamki — dragon ek baar ke liye ruka.'));
                if (dmg > 0) { msgs.push(wa(`Dragon ki aag! HP -${dmg}${anti ? ' (antidote ne kuch roka)' : ''}`)); damage(dmg, 'dragon'); }
                if (S.hp <= 0) return [...msgs, ...gameOver('Dragon ne maar diya.')];
                msgs.push(sc ? st('BLUE SCALE! Ancient Blade — DIRECT HIT!') : st('Ancient Blade se ek powerful strike!'));
                msgs.push(it('⚔️ DRAGON DEFEATED! Ancient Blade ne curse toda!'));
                addScore(120 + bonus);
            } else if (hs) {
                msgs.push(st('"DRACONIS INFERNUM — AETHON!" — Awaaz ne dungeon hilaa diya!'));
                msgs.push(st('Dragon kaanpa. Magic ki lau ne usse ghera. 300 saal ka curse toota.'));
                msgs.push(it('📖 DRAGON DEFEATED! Spell Book ki magic se free kiya!'));
                addScore(105 + bonus);
            } else { // sword
                msgs.push(st('Sword uthake dragon ki taraf dauda!'));
                if (dmg > 0) { msgs.push(wa(`Dragon ki aag! HP -${dmg}`)); damage(dmg, 'dragon'); }
                if (S.hp <= 0) return [...msgs, ...gameOver('Dragon ne maar diya.')];
                msgs.push(sc ? st('Weak point yaad tha — BLUE SCALE! Sword se precise hit!') : st('Sword se ek baar, do baar — dragon kaanpa!'));
                msgs.push(it(`⚔️ DRAGON DEFEATED! ${sc ? 'Weak point use kiya!' : 'Himmat se!'}`));
                addScore((sc ? 90 : 65) + bonus);
            }

            S.flags.dragonDead = true;
            msgs.push(st('Dragon ki raakh... aur ek khamoshi. Phir: "Shukriya..." — ek faint whisper.'));
            msgs.push(st('Throne ke peeche GOLDEN CHEST chamak rahi hai.'));
            msgs.push(sy('Type: take treasure'));
            setTimeout(() => startBGM('throne_clear'), 2500);
            particles(window.innerWidth / 2, window.innerHeight / 2, '#ff6030', 50);
            return msgs;
        }

        // ── CHEST / TREASURE ─────────────────────────────────────
        function openChest() {
            if (S.loc !== 'secret') return [wa('Yahan chest nahi.')];
            const hasKey = S.inv.includes('key') || S.inv.includes('cryptkey');
            const hasPick = S.inv.includes('lockpick');
            if (!hasKey && !hasPick) return [wa('Key ya lockpick chahiye. (key: alley mein | lockpick: alley mein | silver key: crypt search)')];
            if (S.flags.chestOpen) return [sy('Chest khul chuka hai.')];
            S.flags.chestOpen = true; addScore(50); playChestOpen();
            particles(window.innerWidth / 2, window.innerHeight / 2, '#f0c060', 35);
            const method = hasPick && !hasKey ? 'Lockpick se khola' : 'Key se khola';
            return [sep('━━━ CHEST KHULA! ━━━'),
            st(`${method} — CLICK CLICK — chest khul gaya!`),
            it('💎 ANDAR: 500 sone ke sikke, ek necklace, aur Captain Rhenvar ka note!'),
            st('"Dragon ka weak point: LEFT WING, BLUE SCALE. Oracle se milo. Use free karo. — R"'),
            sy('SCORE +50! Catacombs bhi explore karo (east), ya throne room jao!'),
            ];
        }

        // ── PLACE CROWN ──────────────────────────────────────────
        function placeCrown() {
            return useItem('crown fragment');
        }

        // ── VIEW JOURNAL ─────────────────────────────────────────
        function viewJournal() {
            if (!S.journal.length) return [sy('Journal khaali hai. Lore items collect karo.')];
            const entries = S.journal.map((j, i) => `${i + 1}. ${j.title}`).join(' | ');
            return [sep('━━━ JOURNAL ━━━'),
            sy(`${S.journal.length} entries: ${entries}`),
            sy('Specific entry padhne ke liye: read journal [number] — e.g. read journal 1'),
            ];
        }

        function viewJournalEntry(num) {
            const idx = parseInt(num) - 1;
            if (isNaN(idx) || idx < 0 || idx >= S.journal.length) return [wa('Is number ka journal entry nahi.')];
            const j = S.journal[idx];
            return [sep('━━━ ' + j.title.toUpperCase() + ' ━━━'), st(j.text)];
        }

        // ── WORLD MAP ────────────────────────────────────────────
        function showMap() {
            return [sep('━━━ DUNGEON MAP ━━━'),
            ht('[CATACOMBS]←—[SECRET]←north—[ALLEY]—west→[ENTRANCE]—south→[CRYPT]—east→[WELL]'),
            ht('                                           |                                    |'),
            ht('                                         north                                south'),
            ht('                                           |                                    |'),
            ht('[RITUAL]   [ARMORY]←—[BARRACKS]←east—[HALL]—west→[LIBRARY]—north→[GARDEN]←——\''),
            ht('  |east→[STUDY]                         north'),
            ht('                                           |'),
            ht('[ORACLE]←west—[THRONE]←north—[ANTECHAMBER]←south—[HALL]'),
            sy(`Current: ${ROOMS[S.loc].name} | HP: ${S.hp}/${S.maxHp} | Score: ${S.score}`),
            sy(`Rooms found: ${Object.keys(ROOMS).filter(r => S.flags['visited' + r.charAt(0).toUpperCase() + r.slice(1)]).length}/${Object.keys(ROOMS).length}`),
            ];
        }

        // ── STATUS ───────────────────────────────────────────────
        function showStatus() {
            const explored = Object.keys(ROOMS).filter(r => S.flags['visited' + r.charAt(0).toUpperCase() + r.slice(1)]).length;
            const weapons = S.inv.filter(i => ['sword', 'spellbook', 'ancientblade', 'poisondagger', 'throwingknives'].includes(i));
            const armor2 = S.inv.filter(i => ['shield', 'armor', 'amulet'].includes(i));
            return [sep('━━━ STATUS ━━━'),
            sy(`HP: ${S.hp}/${S.maxHp} | Score: ${S.score} | Steps: ${S.steps} | Chapter: ${S.chapter}/5`),
            sy(`Weapons: ${weapons.length ? weapons.map(w => w.toUpperCase()).join(', ') : 'NONE'}`),
            sy(`Defense: ${armor2.length ? armor2.map(a => a.toUpperCase()).join(', ') : 'NONE'}`),
            sy(`Rooms: ${explored}/${Object.keys(ROOMS).length} | Journal: ${S.journal.length} entries`),
            sy(`Flags: torch=${S.flags.torchLit ? '✓' : '✗'} | map=${S.inv.includes('map') ? '✓' : '✗'} | ghost=${S.flags.ghostTalked ? '✓' : '✗'} | oracle=${S.flags.oracleTalked ? '✓' : '✗'} | ritual=${S.flags.ritualSolved ? '✓' : '✗'}`),
            ];
        }

        // ─── GAME OVER + WIN ────────────────────────────────────
        function gameOver(r) {
            S.gameOver = true; startBGM('gameover');
            return [sep('━━━ GAME OVER ━━━'),
            { type: 'lose', text: r },
            { type: 'lose', text: 'Score: ' + S.score + ' | Steps: ' + S.steps + ' | Chapter: ' + S.chapter + '/5' },
            sy('Type "restart" — nayi kahani, nayi choices...'),
            ];
        }

        function gameWin() {
            S.gameOver = true;
            const inv = S.inv;
            const explored = Object.keys(ROOMS).filter(r => S.flags['visited' + r.charAt(0).toUpperCase() + r.slice(1)]).length;
            const hs = inv.includes('spellbook'), hm = inv.includes('map');
            const ab = inv.includes('ancientblade'), pd = inv.includes('poisondagger');
            const hc = S.flags.chestOpen, oc = S.flags.oracleTalked;
            const gh = S.flags.ghostTalked, vg = S.flags.valdrosGhostTalked;
            const rs = S.flags.ritualSolved, cp = S.flags.crownPlaced;
            const jl = S.journal.length;
            const fullExplore = explored >= 15;

            let title, stars, ending;

            if (fullExplore && hs && hm && hc && oc && ab && rs && cp && vg && jl >= 10) {
                title = '⚜️ LEGENDARY SEEKER — PERFECT RUN'; stars = '★★★★★';
                ending = 'PERFECT ENDING! Har room explore kiya, Valdros ki ghost se mili, Rhenvar se baat ki, Oracle ne guide kiya, Ritual complete kiya, Crown place kiya, Ancient Blade se dragon ko free kiya. Raja Valdros ki 300 saal purani aatma ko peace mila. Aethon free hua. Tumhara naam dungeon ki deewaron par hamesha ke liye likha rahega.';
            } else if (oc && ab && rs) {
                title = '🔮 THE ORACLE\'S CHOSEN'; stars = '★★★★★';
                ending = 'Oracle ki guidance, ritual ki power, aur Ancient Blade se Aethon ko free kiya. Prophecy sach hua. Yahi woh path tha jo 300 saal se intezaar kar raha tha.';
            } else if (cp && gh && oc) {
                title = '👑 THE CURSE BREAKER'; stars = '★★★★★';
                ending = 'Rhenvar se mili, Oracle se jaana, aur Crown place kar ke Valdros ki aatma ko peace di. Teen aatmaon ko ek saath free kiya — Valdros, Aethon, Rhenvar.';
            } else if (S.flags.knivesThrown && S.flags.visionSeen && !S.flags.dragonFoughtFrontally) {
                title = '🎯 THE MARKSMAN'; stars = '★★★★☆';
                ending = '3 knives, ek perfect aim, ek weak point. Koi drama nahi, koi spell nahi. Ek professional marksman ki tarah.';
            } else if (S.inv.includes('poisonherb') === false && pd && !S.flags.dragonFoughtFrontally) {
                title = '🗡️ THE SHADOW SLAYER'; stars = '★★★★☆';
                ending = 'Poison Dagger, left wing, perfect sneak. Rhenvar ka kaam tumne complete kiya. Woh finally rest kar sakta hai.';
            } else if (fullExplore && hm && hc && jl >= 8) {
                title = '🗺️ THE EXPLORER'; stars = '★★★★☆';
                ending = 'Har raaz, har kahani, har room. Asli khazana sirf sona nahi tha — yeh dungeon ki poori kahani thi.';
            } else if (S.flags.ritualSolved && hs) {
                title = '📖 THE SCHOLAR'; stars = '★★★☆☆';
                ending = 'Ritual complete ki, Spell Book use ki. Ek intellectual victory. Par aur bhi tha dhundne ke liye...';
            } else if (hs && hm && hc && gh) {
                title = '🧙 THE SCHOLAR WARRIOR'; stars = '★★★☆☆';
                ending = 'Map, Spell Book, Secret Chest, Ghost se baat — ek near-complete run. Oracle aur Ancient Blade bhi try karna tha!';
            } else if (hs) {
                title = '📖 THE SPELL MASTER'; stars = '★★☆☆☆';
                ending = 'Spell Book se jeet. Effective! Par dungeon mein 15 aur rooms the, 10+ journal entries, NPCs...';
            } else if (ab) {
                title = '⚔️ THE ANCIENT WARRIOR'; stars = '★★★☆☆';
                ending = 'Deepest secret dhundha — Ancient Blade mili. Worthy one!';
            } else {
                title = '🗡️ THE BRAVE FOOL'; stars = '★☆☆☆☆';
                ending = 'Sirf sword aur himmat. Simple — par effective. 15 rooms mein se sirf thoda dekha — agli baar zyada dhundho!';
            }

            playVictory();
            particles(window.innerWidth / 2, window.innerHeight / 2, '#f0c060', 80);
            return [sep('═══════════════════════════════════'),
            ch('★ DUNGEON CONQUERED! ★'),
            ch(title),
            ch(stars),
            sep('═══════════════════════════════════'),
            st(ending),
            sy(`Explored: ${explored}/${Object.keys(ROOMS).length} rooms | Journal: ${jl} entries | Chapter: ${S.chapter}/5`),
            ch('Final Score: ' + S.score),
            sy('10 different endings hain — try restart!'),
            ];
        }

        // ═══════════════════════════════════════════════════════════
        // ITEM ALIAS + PARSER
        // ═══════════════════════════════════════════════════════════
        const ALIAS = {
            torch: 'torch', 'old torch': 'torch', 'moshaal': 'torch',
            map: 'map', 'old map': 'map', 'naksha': 'map',
            sword: 'sword', 'rusty sword': 'sword', 'talwaar': 'sword',
            shield: 'shield', 'iron shield': 'shield', 'dhaal': 'shield',
            key: 'key', 'mysterious key': 'key', 'chabi': 'key',
            note: 'note1', 'note1': 'note1', 'crumpled note': 'note1', 'khat': 'note1',
            coin: 'coin', 'gold coin': 'coin', 'sikka': 'coin',
            potion: 'potion', 'health potion': 'potion', 'dawa': 'potion',
            holywater: 'holywater', 'holy water': 'holywater',
            cryptkey: 'cryptkey', 'silver key': 'cryptkey',
            rope: 'rope', 'rassi': 'rope',
            herb: 'herb', 'healing herb': 'herb', 'neeli herb': 'herb',
            poisonherb: 'poisonherb', 'poison herb': 'poisonherb', 'laal herb': 'poisonherb',
            seeds: 'seeds', 'magic seeds': 'seeds', 'beej': 'seeds',
            lantern: 'lantern', 'lamp': 'lantern',
            rations: 'rations', 'food': 'rations',
            armor: 'armor', 'chainmail': 'armor', 'chainmail armor': 'armor',
            poisondagger: 'poisondagger', 'poison dagger': 'poisondagger', 'dagger': 'poisondagger',
            throwingknives: 'throwingknives', 'throwing knives': 'throwingknives', 'knives': 'throwingknives',
            amulet: 'amulet', 'fire amulet': 'amulet', 'taweez': 'amulet',
            scroll: 'scroll', 'ancient scroll': 'scroll',
            journalpage: 'journalpage', 'torn page': 'journalpage', 'page': 'journalpage',
            runestone: 'runestone', 'rune stone': 'runestone', 'rune': 'runestone',
            candles: 'candles', 'black candles': 'candles',
            dragonscale: 'dragonscale', 'dragon scale': 'dragonscale', 'scale': 'dragonscale',
            cryptscroll: 'cryptscroll', 'crypt scroll': 'cryptscroll',
            valdrosjournal: 'valdrosjournal', 'valdros journal': 'valdrosjournal', 'journal': 'valdrosjournal', 'diary': 'valdrosjournal',
            crownfragment: 'crownfragment', 'crown fragment': 'crownfragment', 'crown': 'crownfragment',
            ancientblade: 'ancientblade', 'ancient blade': 'ancientblade', 'blade': 'ancientblade',
            antidote: 'antidote',
            lockpick: 'lockpick', 'lock pick': 'lockpick',
        };
        const DIRS = { n: 'north', s: 'south', e: 'east', w: 'west' };

        function parse(raw) {
            const ip = raw.toLowerCase().trim().replace(/['"]/g, '');
            if (!ip) return [];
            S.steps++; updateStats();

            // restart
            if (ip === 'restart' || ip === 'reset' || ip === 'new game') {
                stopBGM(0.5); currentBGM = null; realMusicLoaded = false;
                if (realAudio) { realAudio.pause(); realAudio = null; }
                initState(); clearOut(); updateStats(); updateInv(); updateLocation();
                printMsgs([sep('━━━ NAI KAHANI ━━━')]);
                printMsgs(ROOMS.entrance.onEnter());
                printMsgs(ROOMS.entrance.look());
                setTimeout(() => startBGM('entrance'), 1500);
                return [];
            }
            if (S.gameOver) return [sy('Game khatam. Type "restart".')];

            // help
            if (ip === 'help' || ip === '?') return [sep('━━━ ALL COMMANDS ━━━'),
            ht('look / l                      — jagah dekhna'),
            ht('go n/s/e/w (ya north...)      — move karo'),
            ht('pick up [item]                — item uthao'),
            ht('inventory / inv               — bag dekhna'),
            ht('status                        — poori stats'),
            ht('map                           — dungeon ka map'),
            ht('journal                       — lore entries dekhna'),
            ht('examine [thing]               — dhyan se dekho'),
            ht('read [thing/inscription/book] — padho'),
            ht('search                        — hidden items dhundho'),
            ht('use [item]                    — use karo'),
            ht('eat [herb/rations]            — khao'),
            ht('talk to [ghost/oracle/dragon/skeleton/valdros]'),
            ht('fight skeleton / bribe skeleton'),
            ht('use holy water                — skeleton par'),
            ht('drink from well               _ HP restore'),
            ht('pray                          — crypt altar'),
            ht('solve ritual                  — ritual circle mein'),
            ht('fight dragon                  — direct battle'),
            ht('sneak attack                  — stealthy kill'),
            ht('throw knives                  — ranged attack'),
            ht('use poison herb               — throne room mein'),
            ht('open chest                    — secret chamber'),
            ht('place crown                   — throne room mein (after dragon)'),
            ht('take treasure                 — final step!'),
            ht('restart                       — naya game'),
            sep('10 ENDINGS | 17 ROOMS | 5 CHAPTERS | 30+ ACTIONS'),
            ];

            // inventory
            if (ip === 'inventory' || ip === 'inv' || ip === 'i' || ip === 'bag') return [
                S.inv.length ? sy('Items: ' + S.inv.map(x => x.toUpperCase()).join(', ')) : sy('Bag khaali hai.'),
                sy(`HP: ${S.hp}/${S.maxHp} | Score: ${S.score} | Chapter: ${S.chapter}/5`),
            ];

            // quick commands
            if (ip === 'look' || ip === 'l' || ip === 'look around') return ROOMS[S.loc].look();
            if (ip === 'status' || ip === 'stats') return showStatus();
            if (ip === 'map' || ip === 'show map') return showMap();
            if (ip === 'journal') return viewJournal();
            if (ip === 'search' || ip === 'search room') return searchRoom();
            if (ip === 'pray') return prayAction();
            if (ip === 'drink' || ip === 'drink from well' || ip === 'drink water') return drinkWell();
            if (ip === 'solve ritual' || ip === 'ritual solve' || ip === 'complete ritual') return solveRitual();
            if (ip === 'fight skeleton' || ip === 'attack skeleton') return fightSkeleton();
            if (ip === 'bribe skeleton' || ip === 'coin do') return bribeSkeleton();
            if (ip === 'throw knives' || ip === 'throw knife' || ip === 'knives phenk') return throwKnives();
            if (ip === 'fight dragon' || ip === 'attack dragon' || ip === 'fight' || ip === 'attack') return fightDragon();
            if (ip === 'sneak attack' || ip === 'sneak' || ip === 'stealth kill') return sneakAttack();
            if (ip === 'talk to dragon' || ip === 'dragon se baat' || ip === 'talk dragon' || ip === 'speak to dragon') return talkTo('dragon');
            if (ip === 'open chest' || ip === 'chest kholo') return openChest();
            if (ip === 'place crown' || ip === 'crown rakh' || ip === 'use crown') return placeCrown();
            if (ip === 'take treasure' || ip === 'grab treasure' || ip === 'loot' || ip === 'khazana lo') {
                if (S.loc !== 'throne') return [wa('Yahan khazana nahi.')];
                if (!S.flags.dragonDead) return [wa('Dragon zinda hai! Pehle defeat karo.')];
                if (S.flags.treasureTaken) return [sy('Khazana pehle le chuke ho!')];
                S.flags.treasureTaken = true; addScore(200); return gameWin();
            }
            if (ip === 'eat herb' || ip === 'herb khao') return useItem('herb');
            if (ip === 'eat rations' || ip === 'khana khao') return useItem('rations');
            if (ip === 'use torch' || ip === 'light torch') return useItem('torch');
            if (ip === 'use lantern') return useItem('lantern');

            // read journal entry
            const rjm = ip.match(/^(?:read journal|journal)\s+(\d+)$/);
            if (rjm) return viewJournalEntry(rjm[1]);

            // talk to
            const talkM = ip.match(/^(?:talk\s+to|speak\s+to|talk|speak|baat\s+karo|bolo)\s+(.+)$/);
            if (talkM) return talkTo(talkM[1].trim());

            // examine
            const examM = ip.match(/^(?:examine|inspect|dekho|look\s+at|check|dekhna)\s+(.+)$/);
            if (examM) return examineTarget(examM[1].trim());

            // read
            const readM = ip.match(/^(?:read|padho|padh)\s+(.+)$/);
            if (readM) return readThing(readM[1].trim());

            // use
            const useM = ip.match(/^(?:use|eat|consume|pee|istemal)\s+(.+)$/);
            if (useM) return useItem(useM[1].trim());

            // movement
            const gm = ip.match(/^(?:go\s+|walk\s+|move\s+|run\s+|jao\s+)?(?:to\s+)?(north|south|east|west|n|s|e|w)$/);
            if (gm) return goDir(DIRS[gm[1]] || gm[1]);

            // pick up
            const pm = ip.match(/^(?:pick\s+up|take|grab|get|uthao)\s+(.+)$/);
            if (pm) return pickItem(pm[1].trim());

            return [wa('"' + raw.substring(0, 30) + '" — samajh nahi aaya.'), ht('help — sab commands dekhne ke liye')];
        }

        function goDir(dir) {
            const ex = ROOMS[S.loc].exits;
            if (!ex || !ex[dir]) return [wa(dir.toUpperCase() + ' mein koi raasta nahi.')];
            const dest = ex[dir];
            if (dest === 'secret' && !S.inv.includes('key') && !S.inv.includes('cryptkey') && !S.inv.includes('lockpick'))
                return [wa('Darwaza band! Key, Silver Key ya Lockpick chahiye. (alley mein dhundho)'), ht('go west → entrance → east → pick up key')];
            if (dest === 'armory' && !S.flags.skeletonDefeated)
                return [wa('Skeleton Guard raasta rok raha hai! (fight / bribe / use holy water / talk to skeleton)')];
            if (dest === 'valdrosStudy') {
                // study accessible from ritual east
            }
            playStep(); playDoorOpen();
            S.loc = dest; updateLocation();
            const bgmMap = {
                entrance: 'entrance', hall: 'hall', alley: 'alley', library: 'library',
                secret: 'secret', ritual: 'secret', crypt: 'entrance', well: 'library',
                garden: 'library', barracks: 'hall', armory: 'hall', oracle: 'secret',
                catacombs: 'secret', antechamber: 'battle', valdrosStudy: 'library',
                throne: S.flags.dragonDead ? 'throne_clear' : 'battle'
            };
            startBGM(bgmMap[dest] || 'entrance');
            const r = ROOMS[dest];
            return [...r.onEnter(), ...r.look()];
        }

        function pickItem(s) {
            const room = ROOMS[S.loc];
            const item = ALIAS[s] || s;
            if (!room.items || !room.items[item]) return [wa('"' + s + '" yahan nahi hai ya pick nahi ho sakta.')];
            if (S.flags[room.items[item]]) return [wa(item.toUpperCase() + ' pehle le chuke ho.')];
            if (S.loc === 'entrance' && (item === 'torch' || item === 'map')) {
                const other = item === 'torch' ? 'map' : 'torch';
                if (S.inv.includes(other)) return [wa('Dono nahi le sakte! ' + other.toUpperCase() + ' pehle se hai.'), ht('restart — agar choice badlna ho')];
            }
            S.flags[room.items[item]] = true;
            S.inv.push(item); updateInv(); closeModal();
            const pu = PICKUPS[item];
            if (pu) { pu.fx(); updateStats(); notif(item.toUpperCase() + ' MILA!', 'info'); return pu.msgs; }
            return [it(item.toUpperCase() + ' uthaa liya!')];
        }

        // ══════ UI ══════
        const DIR_MAP = { north: '↑', south: '↓', east: '→', west: '←' };
        const INV_ICONS_MAP = {
            torch: '🔦', map: '🗺️', sword: '⚔️', shield: '🛡️', key: '🗝️', spellbook: '📖',
            note1: '📜', coin: '🪙', potion: '🧪', holywater: '💧', rope: '🪢',
            herb: '🌿', poisonherb: '☠️', lantern: '🏮', armor: '🛡️', seeds: '🌱',
            poisondagger: '🗡️', amulet: '🔮', scroll: '📜', ancientblade: '⚔️',
            lockpick: '🔧', cryptkey: '🗝️', rations: '🍖', throwingknives: '🗡️',
            dragonscale: '🐉', runestone: '💎', candles: '🕯️', journalpage: '📄',
            cryptscroll: '📜', valdrosjournal: '📕', crownfragment: '👑', antidote: '⚗️',
        };
        const INV_DESCS_MAP = {
            torch: 'Andheri jagahon par roshni', map: '3 secret raaste dikhata hai',
            sword: 'Dragon se ladne ke liye', shield: 'Dragon ka 40% damage roko',
            key: 'Secret chamber kholti hai', spellbook: 'Dragon ke against max power',
            note1: 'Oracle ka hint', coin: 'Skeleton bribe karo',
            potion: 'HP +40', holywater: 'Skeleton instant defeat',
            rope: 'Well mein climb', herb: 'HP +20',
            poisonherb: 'Dragon ko poison karo', lantern: 'Torch se behtar',
            armor: 'Dragon ka 60% damage roko', seeds: 'Well water se antidote',
            poisondagger: 'Sneak attack = instant kill', amulet: 'Aag 70% protection',
            scroll: 'Dragon ka weak point', ancientblade: 'Legendary — 2x damage',
            lockpick: 'Key ke bina chest kholo', cryptkey: 'Silver key — chest alternate',
            rations: 'HP +15', throwingknives: 'Ranged attack (x3)',
            dragonscale: 'Weak point confirm (blue scale)', runestone: 'Ritual aur oracle ke liye',
            candles: 'Ritual complete karne mein madad', journalpage: 'Story ka ek piece',
            cryptscroll: 'Dragon ka asli naam + history', valdrosjournal: 'Raja ki full confession',
            crownfragment: 'Throne par rakho — true ending', antidote: 'Poison se protection',
        };

        function updateStats() {
            const hp = S.hp;
            document.getElementById('n-hp').textContent = hp;
            document.getElementById('n-score').textContent = S.score;
            document.getElementById('n-steps').textContent = S.steps;
            const fill = document.getElementById('hp-fill');
            fill.style.width = hp + '%';
            fill.style.background = hp > 60 ? 'linear-gradient(90deg,#1a8a50,#40dd80)' : hp > 30 ? 'linear-gradient(90deg,#c06010,#f09030)' : 'linear-gradient(90deg,#aa1818,#ff4040)';
        }

        function updateLocation() {
            const r = ROOMS[S.loc];
            document.getElementById('room-name-txt').textContent = r.name;
            document.getElementById('room-desc-short').textContent = r.short || '';
            const el = document.getElementById('exits-list'); el.innerHTML = '';
            Object.entries(r.exits || {}).forEach(([dir, dest]) => {
                const b = document.createElement('button'); b.className = 'ex-btn';
                b.innerHTML = `<span class="ex-arrow">${DIR_MAP[dir] || dir}</span>${dir.toUpperCase()}<span class="ex-dest">${ROOMS[dest]?.name || dest}</span>`;
                b.onclick = () => run('go ' + dir);
                el.appendChild(b);
            });
        }

        function updateInv() {
            const w = document.getElementById('inv-wrap'); w.innerHTML = '';
            if (!S.inv.length) { w.innerHTML = '<div id="inv-empty">— khaali haath —</div>'; return; }
            S.inv.forEach(item => {
                const d = document.createElement('div'); d.className = 'inv-card';
                d.innerHTML = `<div class="inv-em">${INV_ICONS_MAP[item] || '📦'}</div><div><div class="inv-nm">${item.toUpperCase()}</div><div class="inv-ds">${INV_DESCS_MAP[item] || ''}</div></div>`;
                w.appendChild(d);
            });
        }

        let printQueue = []; let printing = false;

        function printMsgs(msgs) {
            if (!msgs || !msgs.length) return;
            msgs.forEach(m => { if (m && m.text) printQueue.push(m) });
            if (!printing) pumpQueue();
        }

        function pumpQueue() {
            if (!printQueue.length) { printing = false; return; }
            printing = true;
            const m = printQueue.shift();
            const out = document.getElementById('out-wrap');
            const d = document.createElement('div');
            d.className = 'ln ' + m.type;
            d.textContent = m.text;
            out.appendChild(d);
            out.scrollTop = out.scrollHeight;
            setTimeout(pumpQueue, m.type === 'sep' ? 80 : 35);
        }

        function clearOut() { document.getElementById('out-wrap').innerHTML = ''; printQueue = []; }

        function run(cmd) {
            const out = document.getElementById('out-wrap');
            const d = document.createElement('div'); d.className = 'ln cmd'; d.textContent = '> ' + cmd; out.appendChild(d);
            out.scrollTop = out.scrollHeight;
            const res = parse(cmd);
            printMsgs(res);
            document.getElementById('inp').value = '';
            document.getElementById('inp').focus();
        }

        function submit() {
            const v = document.getElementById('inp').value.trim(); if (v) run(v);
        }

        // ══════ EFFECTS ══════
        function shakeScreen() {
            document.getElementById('app').classList.add('shaking');
            setTimeout(() => document.getElementById('app').classList.remove('shaking'), 450);
        }

        function flashRed() {
            const f = document.getElementById('screen-flash');
            f.style.background = 'rgba(180,20,20,0.25)'; f.style.opacity = '1';
            setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.style.background = 'transparent', 300) }, 120);
        }

        function notif(msg, type = 'good') {
            const n = document.getElementById('notifs');
            const d = document.createElement('div'); d.className = 'ntf ' + type; d.textContent = msg;
            n.appendChild(d); setTimeout(() => d.remove(), 3000);
        }

        function particles(x, y, col, count) {
            const c = document.getElementById('ptcl');
            for (let i = 0; i < count; i++) {
                const p = document.createElement('div'); p.className = 'pt';
                const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 120;
                const dur = (0.7 + Math.random() * 0.9).toFixed(2);
                p.style.cssText = `left:${x}px;top:${y}px;width:${3 + Math.random() * 4}px;height:${3 + Math.random() * 4}px;background:${col};--tx:${(Math.cos(ang) * dist).toFixed(0)}px;--ty:${(Math.sin(ang) * dist - 60).toFixed(0)}px;--d:${dur}s;animation-delay:${(Math.random() * 0.15).toFixed(2)}s`;
                c.appendChild(p); setTimeout(() => p.remove(), 2000);
            }
        }

        // ══════ MODAL ══════
        function openModal() { setTimeout(() => document.getElementById('modal').classList.add('open'), 900) }
        function closeModal() { document.getElementById('modal').classList.remove('open') }
        function makeChoice(item) { closeModal(); run('pick up ' + item); }

        // ══════ INTRO / START ══════
        function startGame() {
            initAudio();
            document.getElementById('intro').classList.add('gone');
            document.getElementById('app').classList.add('visible');
            setTimeout(() => {
                resizeScene();
                requestAnimationFrame(renderLoop);
                initState(); updateStats(); updateInv(); updateLocation();
                printMsgs([sep('═══════════════════════════'), { type: 'win', text: 'THE FORGOTTEN DUNGEON' }, { type: 'win', text: '17 Rooms | 5 Chapters | 30+ Actions | 10 Endings' }, sep('═══════════════════════════')]);
                printMsgs(ROOMS.entrance.onEnter());
                printMsgs(ROOMS.entrance.look());
                // Start dungeon ambience
                startBGM('entrance');
            }, 800);
        }

        // ══════ EVENT LISTENERS ══════
        document.getElementById('inp').addEventListener('keydown', e => { if (e.key === 'Enter') submit() });
        window.addEventListener('resize', () => { resizeScene(); initFog() });

        // start intro
        runIntro();