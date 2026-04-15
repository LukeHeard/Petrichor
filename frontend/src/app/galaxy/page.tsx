"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Network, X } from "lucide-react";
import * as THREE from 'three';

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  color: string;
  properties: any;
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
  { label: 'Works', color: '#4ade80' },
  { label: 'Authors', color: '#60a5fa' },
  { label: 'Tags', color: '#c084fc' },
];

function addSceneEnhancements(scene: THREE.Scene) {
  // Starfield — random volume distribution (no sphere-shell dome effect)
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const HALF = 3000;
  const INNER = 300; // keep stars out of the graph cluster

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

    // Warm-to-cool star color variation
    const t = Math.random();
    colors[i * 3]     = 0.75 + t * 0.25;
    colors[i * 3 + 1] = 0.75 + t * 0.15;
    colors[i * 3 + 2] = 0.85 + (1 - t) * 0.15;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 0.9,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const starfield = new THREE.Points(starGeo, starMat);
  starfield.name = 'petrichor-starfield';
  scene.add(starfield);

  // Nebula point lights in node palette colors
  const nebulaDefs = [
    { color: 0x4ade80, intensity: 40, pos: [-180, 80, -60]  as [number, number, number] },
    { color: 0x60a5fa, intensity: 30, pos: [140, -70, 120]  as [number, number, number] },
    { color: 0xc084fc, intensity: 35, pos: [20, 110, -140]  as [number, number, number] },
  ];

  nebulaDefs.forEach(({ color, intensity, pos }, i) => {
    const light = new THREE.PointLight(color, intensity, 350);
    light.position.set(...pos);
    light.name = `nebula-light-${i}`;
    scene.add(light);
  });

  // Soft ambient to keep dark nodes visible
  const ambient = new THREE.AmbientLight(0x1a2018, 3);
  ambient.name = 'petrichor-ambient';
  scene.add(ambient);
}

export default function GalaxyPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const fgRef = useRef<any>(null);
  const sceneEnhancedRef = useRef(false);

  useEffect(() => {
    async function fetchGraphData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/graph`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Failed to fetch graph data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGraphData();
  }, []);

  const handleEngineStop = useCallback(() => {
    if (!fgRef.current) return;

    // Start slow auto-rotation via OrbitControls
    const controls = fgRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.zoomSpeed = 2;
      // Prevent zooming out far enough to see the star volume boundary
      controls.maxDistance = 1200;
    }

    // One-time Three.js scene enhancements
    if (!sceneEnhancedRef.current) {
      sceneEnhancedRef.current = true;
      const scene = fgRef.current.scene();
      if (scene) addSceneEnhancements(scene);
    }
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);

    // Pause auto-rotate while user is inspecting
    const controls = fgRef.current?.controls();
    if (controls) controls.autoRotate = false;

    if (fgRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      const distance = 40;
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
    const controls = fgRef.current?.controls();
    if (controls) controls.autoRotate = true;
  }, []);

  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();

    // Core sphere with emissive glow
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(node.val, 16, 16),
      new THREE.MeshPhongMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: 0.35,
        shininess: 80,
        transparent: true,
        opacity: 1,
      }),
    ));

    // Inner halo
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(node.val * 1.5),
      new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    ));

    // Outer soft corona
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(node.val * 2.8),
      new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    ));

    return group;
  }, []);

  const linkParticleColor = useCallback((link: any) => {
    const src = typeof link.source === 'object' ? link.source : data?.nodes.find(n => n.id === link.source);
    return (src as GraphNode)?.color ?? 'rgba(255,255,255,0.4)';
  }, [data]);

  if (loading) {
    return (
      <div className="galaxy-loading">
        <div className="galaxy-loading-icon">
          <Network size={36} strokeWidth={1.5} />
        </div>
        <p className="galaxy-loading-text">Mapping the galaxy<span className="galaxy-ellipsis" /></p>
      </div>
    );
  }

  return (
    <div className="galaxy-container fade-in-up">

      {/* Header */}
      <div className="galaxy-header" style={{ pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
          Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Galaxy</span>
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)' }}>
          {data?.nodes.length ?? 0} entities · {data?.links.length ?? 0} connections
        </p>
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

      {/* 3D Graph */}
      <div style={{ width: '100%', height: '100%' }}>
        <ForceGraph3D
          ref={fgRef}
          graphData={data ?? { nodes: [], links: [] }}
          nodeId="id"
          nodeLabel="label"
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
        />
      </div>

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
            {selectedNode.properties?.author && (
              <div className="galaxy-inspector-row">
                <span>Author</span>
                <span>{selectedNode.properties.author}</span>
              </div>
            )}
            <div className="galaxy-inspector-row">
              <span>ID</span>
              <span style={{ opacity: 0.4, fontSize: '0.72rem' }}>{selectedNode.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
