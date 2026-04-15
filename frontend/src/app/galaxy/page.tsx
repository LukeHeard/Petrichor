"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Layers, Cuboid, Activity, Network } from "lucide-react";
import * as THREE from 'three';

// Import ForceGraph3D dynamically to avoid SSR issues with 'window'
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
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function GalaxyPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    async function fetchGraphData() {
      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/graph`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch graph data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGraphData();
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (fgRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      // Aim at node from outside it
      const distance = 40;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
        node, // lookAt ({ x, y, z })
        3000  // ms transition duration
      );
    }
  }, [fgRef]);

  // Handle glow effects
  const nodeThreeObject = useCallback((node: any) => {
    const geometry = new THREE.SphereGeometry(node.val);
    const material = new THREE.MeshLambertMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Add glowing halo
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(node.val * 1.5), glowMaterial);
    mesh.add(glowMesh);

    return mesh;
  }, []);

  if (loading) {
     return <div style={{ textAlign: 'center', padding: '10rem 0', color: 'var(--muted)' }}>Initializing 3D Galaxy Engine...</div>;
  }

  return (
    <div className="fade-in-up graph-page-container" style={{ position: 'relative', height: 'calc(100vh - 80px)', width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginTop: '-2rem', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* Absolute overlay elements for UI */}
      <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 10, color: 'white', pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          <Network size={24} style={{ color: 'var(--accent)' }} /> Petrichor <span style={{ opacity: 0.5, fontWeight: 300 }}>Galaxy</span>
        </h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.85rem' }}>Visualizing {data?.nodes.length || 0} entities and {data?.links.length || 0} connections.</p>
      </div>

      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, display: 'flex', gap: '1rem' }}>
         <div className="glass-panel" style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: 'white', fontSize: '0.8rem', display: 'flex', gap: '1.5rem' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} /> Works
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#60a5fa' }} /> Authors
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c084fc' }} /> Tags
           </div>
         </div>
      </div>

      {/* Force Graph Container */}
      <div style={{ width: '100%', height: '100%', cursor: 'grab' }}>
        <ForceGraph3D
          ref={fgRef}
          graphData={data || { nodes: [], links: [] }}
          nodeId="id"
          nodeColor="color"
          nodeLabel="label"
          nodeVal="val"
          linkColor={() => 'rgba(255,255,255,0.1)'}
          linkWidth={0.5}
          nodeThreeObject={nodeThreeObject}
          onNodeClick={handleNodeClick}
          backgroundColor="#0a0a0a"
          showNavInfo={false}
        />
      </div>

      {/* Node Inspector Panel */}
      {selectedNode && (
        <div className="node-inspector glass-panel fade-in-up" style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          width: '300px',
          padding: '1.5rem',
          borderRadius: '12px',
          color: 'white',
          zIndex: 20
        }}>
          <button
            onClick={() => setSelectedNode(null)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer' }}
          >
            ✕
          </button>

          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: selectedNode.color, marginBottom: '0.5rem', fontWeight: 600 }}>
            {selectedNode.type} Node
          </div>

          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', lineHeight: 1.3 }}>{selectedNode.label}</h3>

          {selectedNode.properties.thumbnail_url && (
            <img
              src={selectedNode.properties.thumbnail_url}
              alt={selectedNode.label}
              style={{ width: '100%', height: 'auto', borderRadius: '4px', marginBottom: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
            {selectedNode.properties.status && (
              <>
                <div style={{ opacity: 0.6 }}>Status</div>
                <div>{selectedNode.properties.status}</div>
              </>
            )}
            <div style={{ opacity: 0.6 }}>ID</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedNode.id}</div>
          </div>
        </div>
      )}
    </div>
  );
}
