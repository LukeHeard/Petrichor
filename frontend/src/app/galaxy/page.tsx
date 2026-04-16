"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { X, SlidersHorizontal } from "lucide-react";
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

const STATUS_POLES: Record<string, [number, number, number]> = {
  'Reading':  [0,   70,  0],
  'Finished': [-70, -35, -30],
  'Owned':    [70,  -35, -30],
  'DNF':      [0,   -35,  70],
};

// Maps a personal rating (1-5) to a cool→warm color.
// Unrated works keep the default green.
function ratingToColor(rating: number | null | undefined): string {
  if (!rating || rating < 1) return '#7ebf75';
  const t = (Math.min(Math.max(rating, 1), 5) - 1) / 4; // 0→1
  const h = Math.round(210 - t * 185); // 210 (blue) → 25 (orange)
  const s = Math.round(55 + t * 10);
  const l = Math.round(58 - t * 8);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// d3-force-3d compatible cluster force factory
function makeClusterForce() {
  let nodes: any[] = [];
  function force(alpha: number) {
    nodes.forEach(node => {
      if (node.type !== 'Work') return;
      const pole = STATUS_POLES[node.properties?.status];
      if (!pole) return;
      node.vx = (node.vx || 0) + (pole[0] - (node.x || 0)) * 0.04 * alpha;
      node.vy = (node.vy || 0) + (pole[1] - (node.y || 0)) * 0.04 * alpha;
      node.vz = (node.vz || 0) + (pole[2] - (node.z || 0)) * 0.04 * alpha;
    });
  }
  force.initialize = (n: any[]) => { nodes = n; };
  return force;
}

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
  const starMat = new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true });
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
  const [data, setData]               = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [introFading, setIntroFading] = useState(false);
  const [introGone,   setIntroGone]   = useState(false);

  // Filters panel state
  const [showFilters,    setShowFilters]    = useState(false);
  const [visibleTypes,   setVisibleTypes]   = useState({ Work: true, Author: true, Tag: true, Series: true });
  const [colorByRating,  setColorByRating]  = useState(false);
  const [clusterByStatus, setClusterByStatus] = useState(false);
  const [showTimeTravel, setShowTimeTravel] = useState(false);
  const [timeSlider,     setTimeSlider]     = useState(100);

  const fgRef             = useRef<any>(null);
  const sceneEnhancedRef  = useRef(false);
  const introStartRef     = useRef(Date.now());
  const introTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNodeIdsRef    = useRef<Set<string>>(new Set());
  const userPausedRef     = useRef(false);

  const router = useRouter();

  // ── Data fetching ────────────────────────────────────────────────
  const fetchGraphData = useCallback(async (isUpdate = false) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/graph`);
      if (!res.ok) return;
      const newData: GraphData = await res.json();

      if (isUpdate) {
        // Give new nodes a far-out starting position so they fly in
        newData.nodes = newData.nodes.map(node => {
          if (prevNodeIdsRef.current.has(node.id)) return node;
          const theta = Math.random() * Math.PI * 2;
          const phi   = Math.acos(2 * Math.random() - 1);
          const r     = 400 + Math.random() * 200;
          return {
            ...node,
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.cos(phi),
            z: r * Math.sin(phi) * Math.sin(theta),
          };
        });
      }

      prevNodeIdsRef.current = new Set(newData.nodes.map(n => n.id));
      setData(newData);
    } catch (err) {
      console.error("Failed to fetch graph data", err);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
    const handleUpdate = () => fetchGraphData(true);
    window.addEventListener('petrichor:workAdded',   handleUpdate);
    window.addEventListener('petrichor:workUpdated', handleUpdate);
    return () => {
      window.removeEventListener('petrichor:workAdded',   handleUpdate);
      window.removeEventListener('petrichor:workUpdated', handleUpdate);
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
    };
  }, [fetchGraphData]);

  // ── Derived: neighbor IDs for focus mode ────────────────────────
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

  // ── Derived: time range ─────────────────────────────────────────
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
    return new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }, [showTimeTravel, timeSlider, minTime, maxTime]);

  // ── Derived: filtered + colored display data ─────────────────────
  const displayData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const timeCutoff = showTimeTravel
      ? minTime + (maxTime - minTime) * (timeSlider / 100)
      : Infinity;

    // Works that pass visibility & time filters
    const visibleWorkIds = new Set<string>();
    data.nodes.forEach(node => {
      if (node.type !== 'Work' || !visibleTypes.Work) return;
      const t = node.properties?.created_at ? node.properties.created_at * 1000 : 0;
      if (showTimeTravel && t > timeCutoff) return;
      visibleWorkIds.add(node.id);
    });

    // Non-Work nodes that have at least one edge to a visible Work
    const connectedNonWorkIds = new Set<string>();
    data.links.forEach(link => {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target as string;
      if (visibleWorkIds.has(src)) connectedNonWorkIds.add(tgt);
      if (visibleWorkIds.has(tgt)) connectedNonWorkIds.add(src);
    });

    const filteredNodes = data.nodes.filter(node => {
      if (node.type === 'Work') return visibleWorkIds.has(node.id);
      if (!visibleTypes[node.type as keyof typeof visibleTypes]) return false;
      return connectedNonWorkIds.has(node.id);
    });

    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredLinks = data.links.filter(link => {
      const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source as string;
      const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target as string;
      return visibleNodeIds.has(src) && visibleNodeIds.has(tgt);
    });

    // Apply rating-based colors to Work nodes when enabled
    const nodesWithColors = filteredNodes.map(node => {
      if (node.type === 'Work' && colorByRating) {
        return { ...node, color: ratingToColor(node.properties?.personal_rating) };
      }
      return node;
    });

    return { nodes: nodesWithColors, links: filteredLinks };
  }, [data, visibleTypes, colorByRating, showTimeTravel, timeSlider, minTime, maxTime]);

  // ── Cluster force effect ─────────────────────────────────────────
  useEffect(() => {
    if (!fgRef.current) return;
    if (clusterByStatus) {
      fgRef.current.d3Force('cluster', makeClusterForce());
    } else {
      fgRef.current.d3Force('cluster', null);
    }
    fgRef.current.d3ReheatSimulation();
  }, [clusterByStatus]);

  // ── Engine / scene callbacks ─────────────────────────────────────
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
      if      (node.id === focusedNodeId)   opacity = 1;
      else if (neighborIds.has(node.id))    opacity = 0.75;
      else                                  opacity = 0.1;
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

    // Only render halos when opacity is meaningful
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
    const src = typeof link.source === 'object' ? link.source : displayData.nodes.find(n => n.id === link.source);
    return (src as GraphNode)?.color ?? 'rgba(255,255,255,0.4)';
  }, [displayData]);

  // ── Legend items (show count when time travel active) ───────────
  const workCount = displayData.nodes.filter(n => n.type === 'Work').length;

  return (
    <div className="galaxy-container fade-in-up">

      {/* Header */}
      <div className="galaxy-header" style={{ pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Galaxy</span>
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)' }}>
          {showTimeTravel && sliderDate
            ? `${workCount} works · through ${sliderDate}`
            : `${data?.nodes.length ?? 0} entities · ${data?.links.length ?? 0} connections`}
        </p>
      </div>

      {/* Legend (top-right) */}
      <div className="galaxy-legend">
        {LEGEND_ITEMS.map(({ label, color }) => (
          <div key={label} className="galaxy-legend-item">
            <span className="galaxy-legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Filters toggle (top-left, below header) */}
      <button
        className="galaxy-filter-toggle-btn"
        onClick={() => setShowFilters(v => !v)}
        aria-label="Toggle filters"
        title="Filters"
      >
        <SlidersHorizontal size={15} />
      </button>

      {/* Filters panel (left side) */}
      {showFilters && (
        <div className="galaxy-filters-panel">
          <p className="galaxy-filters-section-label">Node Types</p>
          {LEGEND_ITEMS.map(({ label, color }) => (
            <label key={label} className="galaxy-filter-row">
              <input
                type="checkbox"
                checked={visibleTypes[label as keyof typeof visibleTypes]}
                onChange={e => setVisibleTypes(v => ({ ...v, [label]: e.target.checked }))}
              />
              <span className="galaxy-legend-dot" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
              <span>{label}</span>
            </label>
          ))}

          <div className="galaxy-filters-divider" />
          <p className="galaxy-filters-section-label">View</p>

          <label className="galaxy-filter-row">
            <input
              type="checkbox"
              checked={colorByRating}
              onChange={e => setColorByRating(e.target.checked)}
            />
            <span>Color by Rating</span>
          </label>

          {colorByRating && (
            <div className="galaxy-rating-gradient">
              <span>1★</span>
              <div className="galaxy-rating-gradient-bar" />
              <span>5★</span>
            </div>
          )}

          <label className="galaxy-filter-row" style={{ marginTop: colorByRating ? '0.25rem' : 0 }}>
            <input
              type="checkbox"
              checked={clusterByStatus}
              onChange={e => setClusterByStatus(e.target.checked)}
            />
            <span>Cluster by Status</span>
          </label>

          {clusterByStatus && (
            <div className="galaxy-status-poles">
              {Object.entries(STATUS_POLES).map(([status]) => (
                <span key={status} className="galaxy-status-badge">{status}</span>
              ))}
            </div>
          )}

          <div className="galaxy-filters-divider" />
          <p className="galaxy-filters-section-label">Time Travel</p>

          <label className="galaxy-filter-row">
            <input
              type="checkbox"
              checked={showTimeTravel}
              onChange={e => setShowTimeTravel(e.target.checked)}
            />
            <span>Enable</span>
          </label>

          {showTimeTravel && (
            <div className="galaxy-time-control">
              <input
                type="range"
                min={0} max={100}
                value={timeSlider}
                onChange={e => setTimeSlider(parseInt(e.target.value))}
                className="galaxy-time-slider"
              />
              <div className="galaxy-time-labels">
                <span>{new Date(minTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
                <span className="galaxy-time-current">{sliderDate ?? 'Now'}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
                <span style={{ color: '#d1a75c', letterSpacing: '0.05em' }}>
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
