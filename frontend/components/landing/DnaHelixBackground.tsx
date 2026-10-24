"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function DnaHelixBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement("canvas");
      const gl =
        testCanvas.getContext("webgl") ||
        testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    // Check user reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReducedMotion = mediaQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      isReducedMotion = e.matches;
    };
    mediaQuery.addEventListener("change", onMotionChange);

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060a, 0.035);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 16);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }

    // Lighting (Atmospheric Blue & Ice White Specular)
    const ambientLight = new THREE.AmbientLight(0x10294b, 1.6);
    scene.add(ambientLight);

    // Key Light: Light Sky Blue
    const keyLight = new THREE.DirectionalLight(0x9edcff, 3.2);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);

    // Rim Light: Electric Sky Blue from behind
    const rimLight = new THREE.DirectionalLight(0x58aae1, 4.0);
    rimLight.position.set(-10, -6, -8);
    scene.add(rimLight);

    // Fill Light: Deep Atmospheric Blue
    const fillLight = new THREE.DirectionalLight(0x244b78, 2.0);
    fillLight.position.set(0, -12, 6);
    scene.add(fillLight);

    // Specular Highlight Point Light: Pure Ice White
    const pointLight = new THREE.PointLight(0xffffff, 2.5, 24);
    pointLight.position.set(2, 4, 7);
    scene.add(pointLight);

    // Group holding the entire DNA Helix
    const helixGroup = new THREE.Group();
    // Tilt diagonally matching Reference 2 Magnific
    helixGroup.rotation.z = -0.32;
    helixGroup.rotation.x = 0.22;
    helixGroup.position.set(0.6, 0.2, 0);
    scene.add(helixGroup);

    // Materials (Translucent Glass & Crystalline Highlights)
    const glassStrandMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xb9e4ff),
      emissive: new THREE.Color(0x0a2244),
      emissiveIntensity: 0.15,
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.88,
      thickness: 1.4,
      ior: 1.48,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    const rungMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xe1f3ff),
      emissive: new THREE.Color(0x123157),
      emissiveIntensity: 0.2,
      roughness: 0.14,
      metalness: 0.22,
      transmission: 0.78,
      thickness: 1.0,
      ior: 1.45,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    const capMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff),
      roughness: 0.1,
      metalness: 0.5,
      specularIntensity: 1.2,
      transparent: true,
      opacity: 0.95,
    });

    // Procedural DNA Geometry Generation
    const turns = 2.4;
    const heightSpan = 22;
    const radius = 3.4;
    const samples = 140;

    const pointsA: THREE.Vector3[] = [];
    const pointsB: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const progress = i / samples;
      const angle = progress * turns * Math.PI * 2;
      const y = (progress - 0.5) * heightSpan;

      const xA = Math.cos(angle) * radius;
      const zA = Math.sin(angle) * radius;

      const xB = Math.cos(angle + Math.PI) * radius;
      const zB = Math.sin(angle + Math.PI) * radius;

      pointsA.push(new THREE.Vector3(xA, y, zA));
      pointsB.push(new THREE.Vector3(xB, y, zB));
    }

    const curveA = new THREE.CatmullRomCurve3(pointsA);
    const curveB = new THREE.CatmullRomCurve3(pointsB);

    // Tube Backbones
    const tubeGeoA = new THREE.TubeGeometry(curveA, 160, 0.26, 16, false);
    const tubeGeoB = new THREE.TubeGeometry(curveB, 160, 0.26, 16, false);

    const meshA = new THREE.Mesh(tubeGeoA, glassStrandMaterial);
    const meshB = new THREE.Mesh(tubeGeoB, glassStrandMaterial);
    helixGroup.add(meshA);
    helixGroup.add(meshB);

    // Base-Pair Rungs (Connecting Cylinders with Hexagonal Caps)
    const rungCount = 38;
    const rungGeometries: THREE.BufferGeometry[] = [];

    for (let i = 0; i < rungCount; i++) {
      const progress = (i + 0.5) / rungCount;
      const angle = progress * turns * Math.PI * 2;
      const y = (progress - 0.5) * heightSpan;

      const pA = new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );
      const pB = new THREE.Vector3(
        Math.cos(angle + Math.PI) * radius,
        y,
        Math.sin(angle + Math.PI) * radius
      );

      const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
      const fullLength = pA.distanceTo(pB);

      // In Reference 2, each base pair consists of two crystalline segments
      // meeting towards the center with a subtle gap and faceted caps
      const segmentLength = fullLength * 0.41;

      // Peg A (from pA towards mid)
      const centerA = new THREE.Vector3()
        .copy(pA)
        .addScaledVector(dir, segmentLength * 0.5 + 0.25);
      const pegGeoA = new THREE.CylinderGeometry(0.14, 0.14, segmentLength, 8);
      const pegMeshA = new THREE.Mesh(pegGeoA, rungMaterial);
      pegMeshA.position.copy(centerA);
      pegMeshA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      helixGroup.add(pegMeshA);
      rungGeometries.push(pegGeoA);

      // Crystalline cap on Peg A tip
      const capGeoA = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 6);
      const capMeshA = new THREE.Mesh(capGeoA, capMaterial);
      const capPosA = new THREE.Vector3()
        .copy(pA)
        .addScaledVector(dir, segmentLength + 0.24);
      capMeshA.position.copy(capPosA);
      capMeshA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      helixGroup.add(capMeshA);
      rungGeometries.push(capGeoA);

      // Peg B (from pB towards mid)
      const centerB = new THREE.Vector3()
        .copy(pB)
        .addScaledVector(dir, -(segmentLength * 0.5 + 0.25));
      const pegGeoB = new THREE.CylinderGeometry(0.14, 0.14, segmentLength, 8);
      const pegMeshB = new THREE.Mesh(pegGeoB, rungMaterial);
      pegMeshB.position.copy(centerB);
      pegMeshB.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      helixGroup.add(pegMeshB);
      rungGeometries.push(pegGeoB);

      // Crystalline cap on Peg B tip
      const capGeoB = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 6);
      const capMeshB = new THREE.Mesh(capGeoB, capMaterial);
      const capPosB = new THREE.Vector3()
        .copy(pB)
        .addScaledVector(dir, -(segmentLength + 0.24));
      capMeshB.position.copy(capPosB);
      capMeshB.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      helixGroup.add(capMeshB);
      rungGeometries.push(capGeoB);
    }

    // Sparse, subtle crystalline floating nodes (giving spatial depth)
    const particleCount = 28;
    const particleGeo = new THREE.OctahedronGeometry(0.08, 0);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x9edcff,
      transparent: true,
      opacity: 0.55,
    });
    const particlesGroup = new THREE.Group();

    for (let i = 0; i < particleCount; i++) {
      const pMesh = new THREE.Mesh(particleGeo, particleMat);
      pMesh.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 8
      );
      particlesGroup.add(pMesh);
    }
    scene.add(particlesGroup);

    // Mouse Parallax Interaction (restrained, smooth)
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Handle Window Resizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;

      // Adjust camera distance for mobile vs desktop so helix always fills hero beautifully
      if (w < 768) {
        camera.position.z = 21;
        helixGroup.position.set(0, 0, 0);
      } else {
        camera.position.z = 16;
        helixGroup.position.set(0.6, 0.2, 0);
      }

      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Animation Render Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      if (!isReducedMotion) {
        // Slow continuous rotation
        helixGroup.rotation.y += 0.0035;

        // Gentle floating breathing motion
        helixGroup.position.y = (camera.aspect < 1 ? 0 : 0.2) + Math.sin(elapsedTime * 0.45) * 0.18;

        // Subtle oscillation on key light
        keyLight.position.x = 8 + Math.sin(elapsedTime * 0.3) * 1.5;

        // Floating particles slow drift
        particlesGroup.rotation.y += 0.0008;
      }

      // Smooth mouse parallax damping
      targetX += (mouseX * 0.4 - targetX) * 0.04;
      targetY += (mouseY * 0.3 - targetY) * 0.04;

      camera.position.x = targetX;
      camera.position.y = -targetY;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Comprehensive Resource Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      mediaQuery.removeEventListener("change", onMotionChange);

      tubeGeoA.dispose();
      tubeGeoB.dispose();
      rungGeometries.forEach((g) => g.dispose());
      particleGeo.dispose();

      glassStrandMaterial.dispose();
      rungMaterial.dispose();
      capMaterial.dispose();
      particleMat.dispose();

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Layered cinematic radial background gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle 900px at 50% 42%, #10294B 0%, #0A1B35 40%, #071426 70%, #04060A 100%)
          `,
        }}
      />

      {/* Atmospheric blue illumination center spot */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full blur-[140px] pointer-events-none opacity-45"
        style={{
          background: "radial-gradient(ellipse, #244B78 0%, #0A1B35 60%, transparent 80%)",
        }}
      />

      {/* Vignette overlay to keep edges, corners and lower areas contrasted */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(4, 6, 10, 0.75) 85%, #04060A 100%)",
        }}
      />

      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full opacity-95 transition-opacity duration-1000"
      />

      {/* Fallback when WebGL is unavailable */}
      {!webGlSupported && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-[600px] h-[600px] max-w-full opacity-40 animate-pulse-brand"
            viewBox="0 0 400 400"
            fill="none"
          >
            <path
              d="M 100 50 Q 200 200 300 350 M 300 50 Q 200 200 100 350"
              stroke="#58AAE1"
              strokeWidth="4"
              strokeDasharray="8 6"
            />
            <circle cx="200" cy="200" r="120" stroke="#9EDCFF" strokeWidth="1" opacity="0.3" />
          </svg>
        </div>
      )}
    </div>
  );
}
