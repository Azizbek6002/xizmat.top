import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import api from '../api';

const assetUrl = (url) => {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${url}`;
};

const ImmersiveVideoPlayer = forwardRef(({ tour, isMuted, onTimeUpdate, onEnded, onPlayStateChange }, ref) => {
  const mountRef = useRef(null);
  const videoRef = useRef(null);
  const rendererRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    get paused() {
      return videoRef.current?.paused ?? true;
    },
    get duration() {
      return videoRef.current?.duration || 0;
    },
    get currentTime() {
      return videoRef.current?.currentTime || 0;
    },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.muted = isMuted;
    return undefined;
  }, [isMuted]);

  useEffect(() => {
    const mount = mountRef.current;
    const video = videoRef.current;
    if (!mount || !video || fallback) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFallback(true);
      return undefined;
    }

    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.insertBefore(renderer.domElement, mount.firstChild);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    camera.position.set(0, 0, 0.9);

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const width = 6.4;
    const height = 3.6;
    const segments = 80;
    const geometry = new THREE.PlaneGeometry(width, height, segments, 1);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const normalized = x / (width / 2);
      const edgePull = 1 - Math.cos(Math.abs(normalized) * Math.PI * 0.5);
      positions.setZ(i, -3.1 + edgePull * 0.85);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const screen = new THREE.Mesh(geometry, material);
    screen.position.set(0, 0, 0);
    scene.add(screen);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.18, height + 0.18, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x14213d, transparent: true, opacity: 0.36, side: THREE.DoubleSide }),
    );
    glow.position.set(0, 0, -3.22);
    scene.add(glow);

    const state = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
    };

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const pointerDown = (event) => {
      state.dragging = true;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      mount.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event) => {
      if (!state.dragging) return;
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.targetYaw = THREE.MathUtils.clamp(state.targetYaw - dx * 0.003, -0.42, 0.42);
      state.targetPitch = THREE.MathUtils.clamp(state.targetPitch - dy * 0.0024, -0.2, 0.2);
    };
    const pointerUp = (event) => {
      state.dragging = false;
      mount.releasePointerCapture?.(event.pointerId);
    };

    mount.addEventListener('pointerdown', pointerDown);
    mount.addEventListener('pointermove', pointerMove);
    mount.addEventListener('pointerup', pointerUp);
    mount.addEventListener('pointercancel', pointerUp);
    window.addEventListener('resize', resize);
    resize();

    let frameId;
    const render = () => {
      state.yaw += (state.targetYaw - state.yaw) * 0.08;
      state.pitch += (state.targetPitch - state.pitch) * 0.08;
      mount.style.setProperty('--vr-yaw', `${state.yaw * 18}deg`);
      mount.style.setProperty('--vr-pitch', `${state.pitch * -14}deg`);
      camera.rotation.set(state.pitch, state.yaw, 0);
      screen.rotation.y = -state.yaw * 0.18;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      mount.removeEventListener('pointerdown', pointerDown);
      mount.removeEventListener('pointermove', pointerMove);
      mount.removeEventListener('pointerup', pointerUp);
      mount.removeEventListener('pointercancel', pointerUp);
      texture.dispose();
      geometry.dispose();
      material.dispose();
      glow.geometry.dispose();
      glow.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
    };
  }, [tour._id, tour.id, fallback]);

  if (fallback) {
    return (
      <video
        ref={videoRef}
        key={tour._id || tour.id}
        className="virtual-tour-video"
        src={assetUrl(tour.fileUrl)}
        poster={assetUrl(tour.previewImageUrl) || undefined}
        crossOrigin="anonymous"
        muted={isMuted}
        playsInline
        preload="metadata"
        onPlay={() => onPlayStateChange(true)}
        onPause={() => onPlayStateChange(false)}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
    );
  }

  return (
    <div
      className="virtual-tour-immersive"
      ref={mountRef}
      style={tour.previewImageUrl ? { backgroundImage: `linear-gradient(rgba(5,7,11,0.28), rgba(5,7,11,0.72)), url(${assetUrl(tour.previewImageUrl)})` } : undefined}
    >
      <video
        ref={videoRef}
        key={tour._id || tour.id}
        className="virtual-tour-immersive-video"
        src={assetUrl(tour.fileUrl)}
        poster={assetUrl(tour.previewImageUrl) || undefined}
        crossOrigin="anonymous"
        muted={isMuted}
        playsInline
        preload="metadata"
        onPlay={() => onPlayStateChange(true)}
        onPause={() => onPlayStateChange(false)}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
      <div className="virtual-tour-mode-badge">VR-like immersive</div>
      <div className="virtual-tour-immersive-hint">Drag qiling yoki telefonda barmoq bilan aylantiring</div>
    </div>
  );
});

const VirtualTourModal = ({ tours = [], initialTourId, isOpen, onClose }) => {
  const shellRef = useRef(null);
  const videoRef = useRef(null);
  const [currentId, setCurrentId] = useState(initialTourId || tours?.[0]?._id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  const currentIndex = useMemo(() => {
    const index = tours.findIndex((tour) => tour._id === currentId || tour.id === currentId);
    return index >= 0 ? index : 0;
  }, [currentId, tours]);

  const currentTour = tours[currentIndex];

  useEffect(() => {
    if (isOpen) {
      setCurrentId(initialTourId || tours?.[0]?._id);
      setProgress(0);
      setIsPlaying(false);
    }
  }, [initialTourId, isOpen, tours]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goTo(1);
      if (event.key === 'ArrowLeft') goTo(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!isOpen || !currentTour) return null;

  const goTo = (direction) => {
    if (tours.length < 2) return;
    const nextIndex = (currentIndex + direction + tours.length) % tours.length;
    setCurrentId(tours[nextIndex]._id || tours[nextIndex].id);
    setProgress(0);
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    if (!videoRef.current || currentTour.mediaType !== 'video') return;
    if (videoRef.current.paused) {
      await videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      shellRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const renderViewer = () => {
    if (currentTour.mediaType === 'panorama') {
      return <div className="virtual-tour-placeholder">Pannellum panorama viewer keyin qo'shiladi</div>;
    }
    if (currentTour.mediaType === 'video360') {
      return <div className="virtual-tour-placeholder">A-Frame 360 video viewer keyin qo'shiladi</div>;
    }
    return (
      <ImmersiveVideoPlayer
        ref={videoRef}
        tour={currentTour}
        isMuted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onPlayStateChange={setIsPlaying}
      />
    );
  };

  return (
    <div className="virtual-tour-modal" role="dialog" aria-modal="true" ref={shellRef}>
      <div className="virtual-tour-topbar">
        <div>
          <div className="virtual-tour-kicker">Virtual ko'rish</div>
          <h2>{currentTour.title || "Xonani ko'rish"}</h2>
          {currentTour.description && <p>{currentTour.description}</p>}
        </div>
        <button type="button" className="virtual-tour-icon-btn" onClick={onClose} aria-label="Yopish">x</button>
      </div>

      <div className="virtual-tour-stage">
        {renderViewer()}
        {currentTour.mediaType === 'video' && (
          <button type="button" className="virtual-tour-play" onClick={togglePlay}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      <div className="virtual-tour-progress">
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="virtual-tour-controls">
        <button type="button" className="btn btn-outline" onClick={() => goTo(-1)} disabled={tours.length < 2}>Oldingi xona</button>
        <button type="button" className="btn" onClick={togglePlay}>{isPlaying ? 'Pause' : "VR ko'rish"}</button>
        <button type="button" className="btn btn-outline" onClick={() => setIsMuted((value) => !value)}>{isMuted ? 'Ovoz' : 'Mute'}</button>
        <button type="button" className="btn btn-outline" onClick={toggleFullscreen}>To'liq ekran</button>
        <button type="button" className="btn btn-outline" onClick={() => goTo(1)} disabled={tours.length < 2}>Keyingi xona</button>
      </div>
    </div>
  );
};

export default VirtualTourModal;
