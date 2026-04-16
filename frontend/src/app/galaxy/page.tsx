"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { X, Clock } from "lucide-react";
import * as THREE from 'three';
import { useRouter } from "next/navigation";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  color: string;
  properties: {
    thumbnail_url?: string;
    status?: string;
    personal_rating?: number;
    created_at?: number;
    [key: string]: any;
  };
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const LEGEND_ITEMS = [
  { label: 'Works',   color: '#7ebf75' },
  { label: 'Authors', color: '#6D8299' },
  { label: 'Tags',    color: '#d1a75c' },
  { label: 'Series',  color: '#a03040' },
];

function addSceneEnhancements(scene: THREE.Scene) {
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors    = new Float32Array(starCount * 3);
  const HALF = 3000, INNER = 300;

  for (let i = 0; i < starCount; i++) {
    let x: number, y: number, z: number;
    do {
      x = (Math.random() - 0.5) * HALF * 2;
      y = (Math.random() - 0.5) * HALF * 2;
      z = (Math.random() - 0.5) * HALF * 2;
    } while (Math.sqrt(x * x + y * y + z * z) < INNER);
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const t = Math.random();
    colors[i * 3]     = 0.75 + t * 0.25;
    colors[i * 3 + 1] = 0.75 + t * 0.15;
    colors[i * 3 + 2] = 0.85 + (1 - t) * 0.15;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.9, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true,
  });
  const starfield = new THREE.Points(starGeo, starMat);
  starfield.name = 'petrichor-starfield';
  scene.add(starfield);

  const nebulaDefs = [
    { color: 0x7ebf75, intensity: 40, pos: [-180,  80,  -60] as [number, number, number] },
    { color: 0x6D8299, intensity: 30, pos: [ 140, -70,  120] as [number, number, number] },
    { color: 0xd1a75c, intensity: 35, pos: [  20, 110, -140] as [number, number, number] },
    { color: 0xa03040, intensity: 30, pos: [ -60,-120,   80] as [number, number, number] },
  ];
  nebulaDefs.forEach(({ color, intensity, pos }, i) => {
    const light = new THREE.PointLight(color, intensity, 350);
    light.position.set(...pos);
    light.name = `nebula-light-${i}`;
    scene.add(light);
  });

  const ambient = new THREE.AmbientLight(0x1a2018, 3);
  ambient.name = 'petrichor-ambient';
  scene.add(ambient);
}

const INTRO_MIN_MS = 1500;

export default function GalaxyPage() {
  const [data, setData]                   = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode]   = useState<GraphNode | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [introFading, setIntroFading]     = useState(false);
  const [introGone,   setIntroGone]       = useState(false);
  const [showTimeTravel,  setShowTimeTravel]  = useState(false);
  const [timeSlider,      setTimeSlider]      = useState(100);

  const fgRef            = useRef<any>(null);
  const sceneEnhancedRef = useRef(false);
  const introStartRef    = useRef(Date.now());
  const introTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPausedRef    = useRef(false);

  const router = useRouter();

  // ── Data fetching ────────────────────────────────────────────────
  useEffect(() => {
    async function fetchGraphData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/graph`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Failed to fetch graph data", err);
      }
    }
    fetchGraphData();
    return () => { if (introTimerRef.current) clearTimeout(introTimerRef.current); };
  }, []);

  // ── Neighbor IDs for focus mode ──────────────────────────────────
  const neighborIds = useMemo(() => {
    if (!focusedNodeId || !data) return new Set<string>();
    const neighbors = new Set<string>();
    data.links.forEach(link => {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target as string;
      if (src === focusedNodeId) neighbors.add(tgt);
      if (tgt === focusedNodeId) neighbors.add(src);
    });
    return neighbors;
  }, [focusedNodeId, data]);

  // ── Time range ───────────────────────────────────────────────────
  const { minTime, maxTime } = useMemo(() => {
    if (!data) return { minTime: 0, maxTime: Date.now() };
    const times = data.nodes
      .filter(n => n.type === 'Work' && n.properties?.created_at)
      .map(n => (n.properties.created_at as number) * 1000)
      .filter(t => !isNaN(t));
    if (times.length === 0) return { minTime: 0, maxTime: Date.now() };
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }, [data]);

  const sliderDate = useMemo(() => {
    if (!showTimeTravel || minTime === maxTime) return null;
    const t = minTime + (maxTime - minTime) * (timeSlider / 100);
    return new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }, [showTimeTravel, timeSlider, minTime, maxTime]);

  // ── Filtered display data (time travel only) ─────────────────────
  const displayData = useMemo(() => {
    if (!data || !showTimeTravel) return data ?? { nodes: [], links: [] };

    const timeCutoff = minTime + (maxTime - minTime) * (timeSlider / 100);

    const visibleWorkIds = new Set<string>();
    data.nodes.forEach(node => {
      if (node.type !== 'Work') return;
      const t = node.properties?.created_at ? node.properties.created_at * 1000 : 0;
      if (t <= timeCutoff) visibleWorkIds.add(node.id);
    });

    const connectedNonWorkIds = new Set<string>();
    data.links.forEach(link => {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target as string;
      if (visibleWorkIds.has(src)) connectedNonWorkIds.add(tgt);
      if (visibleWorkIds.has(tgt)) connectedNonWorkIds.add(src);
    });

    const filteredNodes = data.nodes.filter(node =>
      node.type === 'Work'
        ? visibleWorkIds.has(node.id)
        : connectedNonWorkIds.has(node.id)
    );

    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks  = data.links.filter(link => {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target as string;
      return visibleNodeIds.has(src) && visibleNodeIds.has(tgt);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, showTimeTravel, timeSlider, minTime, maxTime]);

  const entityCounts = useMemo(() => ({
    Work:   displayData.nodes.filter(n => n.type === 'Work').length,
    Author: displayData.nodes.filter(n => n.type === 'Author').length,
    Tag:    displayData.nodes.filter(n => n.type === 'Tag').length,
    Series: displayData.nodes.filter(n => n.type === 'Series').length,
  }), [displayData.nodes]);

  // ── Engine / scene ───────────────────────────────────────────────
  const handleEngineStop = useCallback(() => {
    if (!fgRef.current) return;
    const controls = fgRef.current.controls();
    if (controls && !userPausedRef.current) {
      controls.autoRotate      = true;
      controls.autoRotateSpeed = 0.35;
      controls.zoomSpeed       = 4;
      controls.maxDistance     = 1200;
    }
    if (!sceneEnhancedRef.current) {
      sceneEnhancedRef.current = true;
      const scene = fgRef.current.scene();
      if (scene) addSceneEnhancements(scene);
    }
    const elapsed = Date.now() - introStartRef.current;
    const delay   = Math.max(0, INTRO_MIN_MS - elapsed);
    introTimerRef.current = setTimeout(() => setIntroFading(true), delay);
  }, []);

  // ── Node interactions ────────────────────────────────────────────
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    setFocusedNodeId(node.id);
    userPausedRef.current = true;

    const controls = fgRef.current?.controls();
    if (controls) controls.autoRotate = false;

    if (fgRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      const distance  = 40;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        2000,
      );
    }
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedNode(null);
    setFocusedNodeId(null);
    userPausedRef.current = false;
    const controls = fgRef.current?.controls();
    if (controls) controls.autoRotate = true;
  }, []);

  // ── Three.js node renderer (focus-aware) ─────────────────────────
  const nodeThreeObject = useCallback((node: any) => {
    let opacity = 1;
    if (focusedNodeId !== null) {
      if      (node.id === focusedNodeId) opacity = 1;
      else if (neighborIds.has(node.id))  opacity = 0.75;
      else                                opacity = 0.1;
    }

    const group = new THREE.Group();

    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(node.val, 16, 16),
      new THREE.MeshPhongMaterial({
        color: node.color, emissive: node.color,
        emissiveIntensity: 0.35, shininess: 80,
        transparent: true, opacity,
      }),
    ));

    if (opacity > 0.05) {
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(node.val * 1.5),
        new THREE.MeshBasicMaterial({
          color: node.color, transparent: true,
          opacity: 0.12 * opacity, side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
        }),
      ));
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(node.val * 2.8),
        new THREE.MeshBasicMaterial({
          color: node.color, transparent: true,
          opacity: 0.04 * opacity, side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
        }),
      ));
    }

    return group;
  }, [focusedNodeId, neighborIds]);

  // ── Hover tooltip ────────────────────────────────────────────────
  const nodeLabel = useCallback((node: any) => {
    if (node.type !== 'Work') {
      return `<span style="font-family:sans-serif;font-size:12px;">${node.label}</span>`;
    }
    const rating = node.properties?.personal_rating;
    const stars  = (rating && rating >= 1)
      ? `<div style="color:#d1a75c;margin-top:4px;font-size:14px;">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</div>`
      : '';
    const img = node.properties?.thumbnail_url
      ? `<img src="${node.properties.thumbnail_url}" style="width:58px;border-radius:4px;display:block;margin-bottom:7px;box-shadow:0 3px 10px rgba(0,0,0,0.5);">`
      : '';
    return `<div style="padding:8px;max-width:160px;">${img}<b style="font-size:13px;line-height:1.35;display:block;">${node.label}</b>${stars}</div>`;
  }, []);

  const linkParticleColor = useCallback((link: any) => {
    const src = typeof link.source === 'object' ? link.source : data?.nodes.find(n => n.id === link.source);
    return (src as GraphNode)?.color ?? 'rgba(255,255,255,0.4)';
  }, [data]);

  return (
    <div className="galaxy-container fade-in-up">

      {/* Header */}
      <div className="galaxy-header" style={{ pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Galaxy</span>
        </h1>
        <p
          style={{
            margin: '0.25rem 0 0',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-sans)',
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
        >
          {showTimeTravel && sliderDate
            ? `${displayData.nodes.length} entities · ${displayData.links.length} connections · ${sliderDate}`
            : `${data?.nodes.length ?? 0} entities · ${data?.links.length ?? 0} connections`}
        </p>
        <div className="galaxy-entity-breakdown">
          {LEGEND_ITEMS.map(({ label, color }) => {
            const singularKey = label === 'Series' ? 'Series' : label.slice(0, -1);
            return (
              <div key={label} className="galaxy-entity-breakdown-row">
                <span className="galaxy-legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <span>{entityCounts[singularKey as keyof typeof entityCounts]} {label.toLowerCase()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="galaxy-legend">
        {LEGEND_ITEMS.map(({ label, color }) => (
          <div key={label} className="galaxy-legend-item">
            <span className="galaxy-legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Time travel — bottom left */}
      <div className="galaxy-timetravel-dock">
        {showTimeTravel && (
          <div className="galaxy-timetravel-panel">
            <p className="galaxy-timetravel-label">Time Travel</p>
            <input
              type="range"
              min={0} max={100}
              value={timeSlider}
              onChange={e => setTimeSlider(parseInt(e.target.value))}
              className="galaxy-time-slider"
            />
            <div className="galaxy-time-labels">
              <span>{new Date(minTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
              <span className="galaxy-time-current">{sliderDate ?? 'Now'}</span>
            </div>
          </div>
        )}
        <button
          className="galaxy-timetravel-btn"
          onClick={() => setShowTimeTravel(v => !v)}
          aria-label="Toggle time travel"
          title="Time Travel"
          style={{ opacity: showTimeTravel ? 1 : undefined, color: showTimeTravel ? 'white' : undefined }}
        >
          <Clock size={15} />
        </button>
      </div>

      {/* 3D Graph */}
      <div style={{ width: '100%', height: '100%' }}>
        <ForceGraph3D
          ref={fgRef}
          graphData={displayData}
          nodeId="id"
          nodeLabel={nodeLabel}
          nodeVal="val"
          linkColor={() => 'rgba(255,255,255,0.18)'}
          linkWidth={0.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={0.8}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={linkParticleColor}
          nodeThreeObject={nodeThreeObject}
          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}
          backgroundColor="#070b09"
          showNavInfo={false}
          warmupTicks={100}
          cooldownTime={3000}
        />
      </div>

      {/* Intro cinematic overlay */}
      {!introGone && (
        <div
          className="galaxy-intro"
          style={{ opacity: introFading ? 0 : 1, pointerEvents: introFading ? 'none' : 'all' }}
          onTransitionEnd={() => setIntroGone(true)}
        >
          <div className="galaxy-intro-content">
            <div className="galaxy-intro-star">✦</div>
            <h1 className="galaxy-intro-title font-serif">
              Petrichor <span>Galaxy</span>
            </h1>
            <p className="galaxy-intro-subtitle">
              Mapping the galaxy<span className="galaxy-ellipsis" />
            </p>
          </div>
        </div>
      )}

      {/* Node Inspector */}
      {selectedNode && (
        <div className="galaxy-inspector fade-in-up">
          <div
            className="galaxy-inspector-accent"
            style={{ background: selectedNode.color, boxShadow: `0 0 12px ${selectedNode.color}` }}
          />

          <button className="galaxy-inspector-close" onClick={handleCloseInspector} aria-label="Close">
            <X size={13} />
          </button>

          <p className="galaxy-inspector-type" style={{ color: selectedNode.color }}>
            {selectedNode.type}
          </p>

          <h3 className="galaxy-inspector-title font-serif">{selectedNode.label}</h3>

          {selectedNode.properties?.thumbnail_url && (
            <img
              src={selectedNode.properties.thumbnail_url}
              alt={selectedNode.label}
              className="galaxy-inspector-image"
            />
          )}

          <div className="galaxy-inspector-details">
            {selectedNode.properties?.status && (
              <div className="galaxy-inspector-row">
                <span>Status</span>
                <span>{selectedNode.properties.status}</span>
              </div>
            )}
            {selectedNode.properties?.personal_rating != null &&
             selectedNode.properties.personal_rating > 0 && (
              <div className="galaxy-inspector-row">
                <span>Rating</span>
                <span style={{ color: '#d1a75c' }}>
                  {'★'.repeat(Math.round(selectedNode.properties.personal_rating))}
                  {'☆'.repeat(5 - Math.round(selectedNode.properties.personal_rating))}
                </span>
              </div>
            )}
            <div className="galaxy-inspector-row">
              <span>ID</span>
              <span style={{ opacity: 0.4, fontSize: '0.72rem' }}>{selectedNode.id}</span>
            </div>
          </div>

          {selectedNode.type === 'Work' && (
            <button
              className="galaxy-inspector-detail-btn"
              onClick={() => {
                const workId = selectedNode.id.replace('work_', '');
                router.push(`/galaxy?book_id=${workId}`);
              }}
            >
              View Full Details →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
