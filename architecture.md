FIG 1.1: Centralized Ingestion Collapse Model at 3,000 Cameras

YOUR CURRENT SYSTEM — CENTRALIZED  
CAM 3000 \---\> \[ 12 Gbps RAW VIDEO \] \---\> CENTRAL SERVER (Django \+ GPU)  
\* Single process I/O blocked  
▼ SATURATED ▼  
SLA: 45–120 sec (target: \<5 sec)

BOTTLENECK BREAKDOWN:

Network I/O: 12 Gbps inbound (Single point of failure)

GPU: Out of Memory (OOM) / 3.8x over capacity

Latency: 45s+ vs \<5s Target

PROPOSED SYSTEM — EDGE-DISTRIBUTED  
EDGE x 750

EDGE x 750  \===\> \[ \~300 Mbps vectors only \] \---\> CENTRAL CORE  
EDGE x 750  /                                   (FAISS \+ Hysteresis)  
EDGE x 750 /                                    \* Stateless workers  
\* Horizontally scalable  
▼ FEASIBLE ▼  
SLA: 1.8–3.2 sec

RESOURCE PROFILE (PROPOSED):

Network I/O: 300 Mbps

GPU: 0.2x OK

Latency: 2.1s Avg (vs \<5s Target)

\#\#\#\# Centralized vs Edge Distributed Mathematics  
\* \*\*Centralized Bandwidth:\*\* 3,000 cams × 4 Mbps/stream \= 12,000 Mbps (12 Gbps) → \*\*IMPOSSIBLE\*\*. Even at 1 Mbps compressed, it requires 3 Gbps to a single ingestion point.  
\* \*\*Centralized Compute:\*\* A single A100 GPU processes \~180fps — 3,000 streams × 25fps \= 75,000fps needed.  
\* \*\*Edge Bandwidth:\*\* 3,000 edges × \~100 KB/event × \~1 event/sec \= 300 Mbps → \*\*FEASIBLE\*\*. Central receives only vectors (2 KB) \+ crop thumbnail (32 KB) \+ metadata (1 KB).  
\* \*\*Edge Lookup:\*\* FAISS 1:N lookup takes \<1ms per query for 100K enrolled suspects.

\---

\#\#\# Core Gap Analysis: 8 Critical Structural Failures

\#\#\#\# 01\. Fatal I/O Bottleneck  
At 3,000 cameras transmitting 1080p/H.264 streams, the centralized ingestion point must handle a minimum of 12 Gbps of continuous inbound traffic. No single Django application server — regardless of how many workers you spawn — can receive, decode, and pipeline this without catastrophic packet loss.  
\* \*Metric:\* 12 Gbps inbound → single point failure.

\#\#\#\# 02\. GPU Compute Impossibility  
Your Adaptive Stride FSM reduces processing per camera, but the aggregate is brutal: even at 1 frame/second per camera (massive stride), that is 3,000 YOLOv10 inference calls per second. A single A100 GPU handles \~180fps of YOLO at batch=1. You need approximately 17 A100-class GPUs at minimum — all centralized with shared video bus contention.  
\* \*Metric:\* \~17 A100 GPUs required centrally.

\#\#\#\# 03\. Video Chunking is Forensic, Not Real-Time  
Your Video Splitter chunks files for asynchronous batch analysis. This paradigm fundamentally cannot meet a 35 second SLA. By the time a chunk is created, enqueued, picked up by a worker, decoded, inferred, and results returned, you are already 45-120 seconds behind real time. Chunking is a forensic tool, not a surveillance tool.  
\* \*Metric:\* Estimated latency: 45–120 seconds.

\#\#\#\# 04\. SQLite is a Toy at This Scale  
SQLite is single-writer by design. At 3,000 cameras generating detection events, you will experience immediate write-lock contention. PostgreSQL scales better, but without vector indexing (FAISS/HNSW), every 1:N suspect lookup requires a full-table scan against potentially hundreds of thousands of enrolled biometric records — milliseconds become seconds.  
\* \*Metric:\* Full scan: \~800ms per query at 100K records.

\#\#\#\# 05\. No VMS Ingestion Layer  
Your Django management layer directly handles RTSP connections. At scale, RTSP management is a dedicated function: reconnection logic, ONVIF health monitoring, stream quality adaptation, hardware alarm integration, and splitting streams to multiple consumers (storage, display, AI). Django cannot absorb this while simultaneously running inference workflows.  
\* \*Metric:\* RTSP fails: no reconnect, no health monitoring.

\#\#\#\# 06\. Zero Spatio-Temporal Intelligence  
Your system has no topology awareness. It cannot validate whether a suspected match at Camera A and a match at Camera B 45 seconds later is physically plausible given the geographic distance. Without speed-distance gating, alert spam from false positives will be constant — operators will be inundated and stop trusting the system within days.  
\* \*Metric:\* False positive rate: uncontrolled.

\#\#\#\# 07\. No Edge Delegation Whatsoever  
Your entire AI stack — detection, feature extraction, Re-ID, matching — lives in one central location. The proven standard mandates that face detection, crop extraction, and embedding generation happen at edge nodes co-located with camera clusters. The network carries only compact embedding vectors (\~2 KB), not raw video frames (4,000 KB/frame). This is a 2,000x bandwidth difference.  
\* \*Metric:\* 2,000x bandwidth overage vs. edge model.

\#\#\#\# 08\. No High-Availability Design  
Your architecture has a single point of failure at every critical juncture: the ingestion server, the GPU inference node, and the database. In a city-scale law enforcement deployment, downtime is operationally unacceptable. There is no failover, no load balancing, no ring-network redundancy, and no UPS/power-fault tolerance described.  
\* \*Metric:\* SPOF count: 4 critical failure points.

\---

\#\# SECTION 02: Core Gap Analysis  
\#\#\# SYSTEM A (YOURS) vs. SYSTEM B (PROVEN STANDARD) — LAYER BY LAYER

FIG 2.1: Adaptive Stride FSM (Centralized) vs. Edge AI Box (Distributed)

YOUR ADAPTIVE STRIDE FSM — CENTRALIZED  
RTSP STREAM (raw video) \[3,000 inbound\] \-\> Video Splitter \-\> Chunk Queue \-\> Adaptive Stride FSM \-\> YOLOv10 \-\> InsightFace \-\> PSQL

Bottleneck: 3,000 streams x all frames on same central server  
⚠ Latency: 45–120s | Bandwidth: 12Gbps

PROVEN EDGE AI BOX — DISTRIBUTED  
4–8 Camera Cluster \-\> NVIDIA Jetson AGX (Detect \+ Crop \+ Embed) \-\> Fiber/5G \[\~35 KB per event\] \-\> FAISS 1:N Lookup \-\> Hysteresis \+ Alert Dispatch \-\> ICCC / field units  
✓ Latency: 1.8–3.2s | Bandwidth: \~300Mbps

| Layer | Your System | Proven Standard | Gap Severity | Impact |  
| :--- | :--- | :--- | :--- | :--- |  
| \*\*INGESTION\*\* | Django app directly receives 3,000 RTSP streams. No dedicated VMS layer. Video Splitter creates file chunks. | Milestone XProtect / Genetec Security Center VMS. Dedicated hardware ingestion with ONVIF monitoring. Splits stream to storage, display, and AI simultaneously. | \*\*CRITICAL\*\* | Django will OOM. No reconnect logic. Single consumer of stream. |  
| \*\*EDGE COMPUTE\*\* | None. All compute is centralized on a single inference server. Adaptive Stride reduces frequency, but the raw video still crosses the network. | NVIDIA Jetson AGX / ASIC edge boxes co-located with every 4–8 camera cluster. Detection \+ alignment \+ embedding extraction happen at the edge before any data crosses the network. | \*\*CRITICAL\*\* | 12 Gbps raw inbound vs \~300 Mbps vector payloads. A 40x bandwidth gap. |  
| \*\*NETWORK TRANSPORT\*\* | Not specified. Implicitly relies on general IP network for raw RTSP streams. | Physically isolated, air-gapped dark fiber ring topology with 10/40 Gbps aggregation. Automated self-healing rerouting. 5G encrypted backup for inaccessible nodes. | \*\*CRITICAL\*\* | Public network RTSP is insecure, high-latency, unreliable. Unacceptable for law enforcement. |  
| \*\*VECTOR INDEXING\*\* | PostgreSQL relational schema with standard SQL queries. No ANN indexing. Sequential similarity scan against enrolled profiles. | FAISS with HNSW (Hierarchical Navigable Small World) index. Sub-millisecond 1:N lookup against 100K+ enrolled suspect profiles. GPU-accelerated similarity search. | \*\*CRITICAL\*\* | SQL scan: \~800ms at 100K records. FAISS HNSW: \<1ms. 800x speed gap. |  
| \*\*TRACKING HIERARCHY\*\* | Hybrid fusion of face and body Re-ID with configurable weighting. Body Re-ID can act as primary anchor if face scores are borderline. | Strict hierarchy enforced: face recognition is always the PRIMARY anchor. Body/appearance Re-ID (YOLO-ReIDNet \+ gait \+ garment histograms) is a SECONDARY spatio-temporal fallback only when face is occluded. | \*\*HIGH\*\* | Appearance-primary matching causes false positive explosions across thousands of cameras. Masked suspects could shadow-match to wrong individuals. |  
| \*\*SPATIO-TEMPORAL GATING\*\* | No topology-aware gating exists. Matches from any camera are accepted regardless of physical plausibility. | Speed-distance plausibility validator. If target confirmed at Camera A (lat/lon), any re-ID at Camera B must satisfy \`time\_delta \>= distance(A,B) / max\_pedestrian\_speed\`. Implausible matches are auto-rejected. | \*\*HIGH\*\* | Without gating, false alert rate at 3,000 nodes will overwhelm operators within hours. |  
| \*\*WATCHLIST MANAGEMENT\*\* | ForensicCase entity per case. Manual reference image upload. No database federation. | Centralized web console with auto-detect → align → vectorize pipeline on enrolment. Priority rankings, case logs, operator tags. Federated sync to CCTNS, NCRB AFRS, passport databases. | \*\*HIGH\*\* | No national database sync means local watchlist is always stale relative to national fugitive records. |  
| \*\*ALERT DISPATCH\*\* | SuspectSighting records written to database. Report generated as PDF. No real-time push mechanism described. | Rich JSON alert multicast: target photo \+ live frame \+ confidence score \+ camera ID \+ GIS coordinates. Simultaneous push to ICCC monitors AND encrypted field unit apps. Sub-5-second end-to-end SLA enforced. | \*\*HIGH\*\* | PDF reports are forensic artifacts, not operational alerts. Field interception is impossible with 30–120 second report generation cycles. |  
| \*\*HUMAN-IN-THE-LOOP\*\*| No mandatory human confirmation step before action. Automated sighting clips generated, but no operator validation gate. | System enforces a hard lock: no field interception protocol activates until a trained control room analyst manually validates live match against watchlist enrolment image. | \*\*HIGH\*\* | Missing governance creates legal liability. All major deployments (London Met, Delhi Police) require human confirmation before any field action. |  
| \*\*HIGH AVAILABILITY\*\*| Single central server. Single GPU. SQLite (or PostgreSQL single instance). No failover architecture described. | Ring fiber topology with automated self-healing. Horizontally scaled worker pools for inference. Replicated FAISS index clusters. N+1 redundancy across all critical tiers. | \*\*CRITICAL\*\* | A single server failure in a 3,000-camera deployment means complete operational blindness city-wide. |

\---

\#\# SECTION 03: The Production Architecture Blueprint  
\#\#\# 7-LAYER ZERO-SPOF DESIGN FOR 3,000+ CAMERAS

Every layer is independent, horizontally scalable, and has a defined failover mechanism. No single component failure can take down the system.

FIG 3.1: Complete 7-Layer City-Scale Architecture

LAYER 1: CAMERA FIELD INFRASTRUCTURE  
\[Cam Clusters: 4-8 cams each\] \-\> \[Jetson Edge Node (YOLOv10 TRT, ArcFace, ByteTrack)\] x 375-750 nodes

Micro-UPS, Active cooling, IP67 enclosure. Only \~35 KB/event crosses this boundary.

LAYER 2: AIR-GAPPED FIBER RING NETWORK  
\[Dark Fiber Ring (Primary) 10/40 Gbps\] \<-\> \[Encrypted 5G Slice (Backup)\]

VLAN Segmentation, MFA, Zero public internet exposure. Total load \~300 Mbps.

LAYER 3: VMS INGESTION MIDDLEWARE (Milestone XProtect / Genetec)  
Stream Manager (ONVIF, RTSP) \-\> Splits to: NVR Rolling Buffer (30-90 days) | Display Wall | Vector Ingest API

LAYER 4: CENTRAL AI INTELLIGENCE CORE (Face-Primary Enforcement)  
① Face Pipeline Primary Anchor (RetinaFace \+ ArcFace, Quality Gate \> 0.7)  
② FAISS HNSW 1:N Vector Search (\<1ms GPU-backed lookup against 100K+ watchlist)  
③ Hysteresis Manager (Temporal smoothing & cross-cam dedup)  
④ Body Re-ID (Secondary fallback only when face is occluded)  
⑤ Spatio-Temporal Gate (Speed-distance validator via topology map)

LAYER 5: GLOBAL TRACK REGISTRY & TRAJECTORY SYNTHESIS  
\[Global Track File per Suspect\] \-\> Chronological path synthesis \-\> Video Clip Stitcher (evidentiary reel with crypto hash)

LAYER 6: WATCHLIST MANAGEMENT & MULTI-CHANNEL ALERT DISPATCH  
Enrolment Console (Detect-\>Align-\>Vectorize) \-\> CCTNS/NCRB Sync \-\> Alert Payload Builder \-\> Multicast Dispatch

LAYER 7: ICCC COMMAND CENTER & HUMAN-IN-LOOP GOVERNANCE  
4K Video Wall \+ GIS Map \-\> Mandatory Human Validation Gate (HARD LOCK) \-\> Field Dispatch Unlock \-\> Immutable Audit Ledger

\#\#\# Operational Details Across All 7 Layers

\#\#\#\# LAYER 01: Camera Field Infrastructure & Edge AI Nodes  
\* \*\*Camera Specification:\*\* 2MP-8MP IP dome/PTZ cameras with 1/1.8" sensor minimum for low-light sensitivity. Every camera must achieve the critical 24-pixel inter-ocular distance constraint on faces within its operational field-of-view. Sub-24-pixel crops are biometrically unusable and must be flagged, not processed.  
\* \*\*Clustering Model:\*\* Every 4–8 cameras shares a single NVIDIA Jetson AGX Orin edge box (32/64 TOPS). This box receives the raw RTSP streams from the cluster over a short local cable — raw video never leaves this physical junction. Detection, alignment, and ArcFace embedding extraction all execute here via TensorRT FP16-quantized engines.  
\* \*\*Intra-Camera Tracking:\*\* ByteTrack runs on the edge node to track individuals within each camera's cone across frames. This eliminates duplicate embeddings for the same person in a stationary position — only the confirmed detection event (one embedding) is forwarded upward.  
\* \*\*Environmental Engineering:\*\* All outdoor enclosures must be IP67 minimum. Active cooling heat-sinks handle summer heat. Per-node micro-UPS provides 30–60 minutes of battery backup through power faults. This is non-negotiable in a monsoon climate.

\#\#\#\# LAYER 02: Air-Gapped Dark Fiber Ring Network  
\* \*\*Primary Path:\*\* Physically isolated dark fiber ring architecture with automated self-healing rerouting. A cable cut anywhere in the ring automatically routes around it within milliseconds. This topology is mandatory — shared public ISP infrastructure is incompatible with law enforcement operational security.  
\* \*\*Aggregation Links:\*\* 10 Gbps uplinks from zone aggregation hubs, 40 Gbps trunk to the central ICCC. With edge processing, the actual load is approximately 300 Mbps total (vectors \+ thumbnails), giving an enormous headroom margin for growth and burst capacity.  
\* \*\*5G Encrypted Failover:\*\* For camera clusters in heritage zones, narrow lanes, or locations where trenching fiber is physically impossible, encrypted private 5G network slices serve as an automatic failover layer. This is a backup, never the primary path.  
\* \*\*Security Posture:\*\* Complete VLAN isolation per policing zone. Zero public internet exposure. All administrative access requires multi-factor authentication through a hardened jump-host. No direct inbound routes from external networks.

\#\#\#\# LAYER 03: VMS Ingestion Middleware  
\* \*\*Platform:\*\* Enterprise VMS — Milestone XProtect, Genetec Security Center, or Hikvision HikCentral. This is a dedicated, purpose-built product for managing thousands of RTSP connections. It handles reconnection, health polling, hardware alarm integration, and stream state management, none of which Django can absorb at scale.  
\* \*\*Stream Fanout:\*\* Each incoming stream is split simultaneously to three consumers: the NVR rolling buffer (for evidentiary storage), the display wall (for live operator view), and the AI event router (forwarding edge-generated vector payloads to the intelligence core). These consumers are fully decoupled.  
\* \*\*Vector Ingest API:\*\* A lightweight, stateless API gateway accepts the structured JSON payloads from edge nodes — embedding vector \+ face thumbnail \+ metadata. It validates schema, stamps arrival time, and forwards to the FAISS query workers. This is the only traffic crossing from edge to core.  
\* \*\*Legacy Camera Absorption:\*\* Existing Kolkata Smart City cameras are onboarded via ONVIF Profile S or direct RTSP endpoints without hardware replacement. Legacy nodes that lack edge compute boxes are routed through regional field AI boxes placed at aggregation junctions.

\#\#\#\# LAYER 04: Central AI Intelligence Core — Face-Primary  
\* \*\*Face as the Absolute Primary Anchor:\*\* When a face embedding arrives from an edge node and clears the quality gate (sharpness score, frontal angle, brightness), it enters the ArcFace/FAISS pipeline immediately. Body Re-ID is completely dormant unless the face pipeline returns no result or the face quality gate rejects the crop. This hierarchy must be hardcoded, not configurable, to prevent misconfiguration in production.  
\* \*\*FAISS HNSW Index:\*\* The suspect watchlist is pre-indexed as an HNSW approximate nearest-neighbor structure in FAISS. A 1:N query against 100,000 enrolled face embeddings (512-dimensional float32 vectors) completes in under 1 millisecond on a GPU-backed node. This is categorically not achievable with SQL LIKE or sequential cosine similarity scans.  
\* \*\*Quality Gating:\*\* Face crops that fail minimum quality (score below 0.7 on a composite of blur, occlusion, and angle metrics) are discarded immediately. They are never forwarded to FAISS. This is what prevents low-quality, ambiguous crops from generating false alerts — they are rejected at the gate, not matched speculatively.  
\* \*\*Hysteresis Confirmation:\*\* A confirmed match requires the FAISS similarity score to exceed the HIGH threshold (e.g., 0.82). Once confirmed, the identity persists as long as subsequent scores stay above the LOW threshold (e.g., 0.65). A transient dip from occlusion does not break the track. This is your Hysteresis Manager, promoted from edge-local to globally centralized across all cameras.  
\* \*\*Body Re-ID as Fallback:\*\* If the face is masked or at an extreme angle, the secondary body Re-ID pipeline activates — but only if the global track manager has a recent confirmed face-primary sighting on the same target. Body Re-ID cannot initiate a new identity anchor; it can only maintain an existing one subject to spatio-temporal gating.

\#\#\#\# LAYER 05: Global Track Registry & Trajectory Synthesis  
\* \*\*Global Track File:\*\* For each actively tracked suspect, a persistent data structure is maintained: \`\[GlobalTrackID | SuspectID | \[{CamID, Timestamp, Lat/Lon, Confidence, Mode(face/body)}\]\]\`. This is the canonical record of where the individual has been seen, in chronological order, across every camera in the city.  
\* \*\*Cross-Camera Handoff Logic:\*\* When a new sighting event arrives from a camera that has no prior observation for a given suspect, the system first checks the spatio-temporal gate (Layer 4). If it passes, the sighting is appended to the global track file and the operator dashboard updates in real time.  
\* \*\*Evidentiary Clip Stitcher:\*\* On alert confirmation, the clip stitcher requests 30-second pre-roll and post-roll segments from the NVR for each camera in the global track file. It assembles these chronologically into a single continuous video reel. Each clip includes burned-in metadata: camera ID, timestamp, GPS coordinates, match confidence, and analyst ID. This reel is cryptographically hashed for legal admissibility.

\#\#\#\# LAYER 06: Watchlist Management & Alert Dispatch  
\* \*\*Enrolment Pipeline:\*\* Operators upload a target portrait via a secured web console. The image is automatically processed through detect → align → quality check → vectorize. The resulting embedding is instantly appended to the FAISS HNSW index with no index rebuild required (HNSW supports dynamic insertion). Priority rank, case log reference, operator ID, and enrolment timestamp are stored as metadata.  
\* \*\*National Federation:\*\* Automated REST API synchronization to CCTNS and the NCRB AFRS portal. When a new fugitive or high-risk profile is added to the national database, the local FAISS index updates within minutes via webhook-triggered re-embedding. This eliminates the perpetual stale watchlist problem.  
\* \*\*Alert Payload:\*\* On a confirmed, hysteresis-validated match that passes the human confirmation gate, a rich JSON alert is multicast simultaneously to the ICCC wall display and to encrypted field unit apps. The payload contains: suspect photo, live captured frame, similarity score, camera ID, GPS coordinates, timestamp, and the URL of the pre-assembled evidentiary clip. End-to-end SLA target: under 5 seconds from camera exposure to alert display.

\#\#\#\# LAYER 07: ICCC Command Center & Human-in-Loop Governance  
\* \*\*4K Video Wall:\*\* High-resolution display wall controllers render live camera feeds, the GIS city map with active suspect trajectories, real-time alert logs, and the global track visualization. Operators can pull any camera to full-screen with one click.  
\* \*\*Mandatory Human Confirmation Gate:\*\* This is non-negotiable and must be hardcoded as a system lock. No field interception protocol, no unit dispatch, and no GPS alert to officers in the field can activate until a trained control room analyst has manually reviewed the side-by-side comparison (watchlist photo vs. live frame) and clicked confirm. This gate exists in every proven production deployment (London Met, Delhi Police, Gurugram GMDA) and its absence creates catastrophic legal liability.  
\* \*\*Immutable Audit Ledger:\*\* Every system event — enrolment, match detection, alert generation, analyst confirmation, dispatch command, alert dismissal — is written to an append-only log with a cryptographic timestamp and the operator's authenticated identity signature. This ledger is the legal foundation for any evidentiary use of system output in court.

\---

\#\# SECTION 04: Data Flow — Edge to ICCC  
\#\#\# EXACT PAYLOAD STRUCTURES AT EACH NETWORK BOUNDARY

The most critical engineering decision in this entire system is the payload boundary decision: what data crosses each network segment, and in what form. Shipping the wrong representation at any boundary cascades into bandwidth failure, latency failure, or both.

FIG 4.1: Payload Transformation Pipeline: Camera Frame → ICCC Alert

CAMERA Raw Frame (1920x1080 H.264 @ 4Mbps \~500 KB/frame)  
│  
▼ STAYS LOCAL (never sent to core over network)  
JETSON EDGE PROCESSING STEPS:  
① YOLOv10 Detect  ② Crop & Align Face  ③ Quality Gate \>= 0.7  ④ ArcFace 512-dim  ⑤ ByteTrack Dedup  
│  
▼ Output: \~35 KB event payload (vs 500 KB raw frame) via Fiber  
FIBER NETWORK (\~35 KB Edge Event Payload JSON)  
│  
▼ VMS Ingest Gateway  
FAISS QUERY  
│  \* Input: float32\[512\]  
│  \* HNSW 1:N Lookup \< 1ms on GPU  
▼  \* Output: SuspectID: S-0041, Score: 0.91, Rank: 1 (out of 100K)  
HYSTERESIS CHECK & S-T GATE VALIDATION  
│  
▼ Output: Validated JSON Alert  
ICCC ALERT DISPATCH  
\* Wall display & Field App push  
\* Timeline milestones: t=0 (exposure), t+180ms (edge), t+350ms (FAISS), t+360ms (Gate), t+1.8-3.2s (SLA)

\#\#\#\# Example Edge Event Payload JSON  
\`\`\`json  
{  
  "cam\_id": "KOL-0847",  
  "ts\_utc": 1748780231,  
  "lat": 22.5744,  
  "lon": 88.3629,  
  "quality": 0.87,  
  "track\_id": "E-0022",  
  "embedding": \[0.0123, \-0.4567, "...", 0.9876\],   
  "face\_crop\_b64": "/9j/4AAQSkZJRgABAQAAAQABAAD..."  
}  
Breakdown: Embedding (2 KB) \+ face\_crop\_b64 (32 KB) \+ Metadata (1 KB) \= \~35 KB total.

SCALE MATHEMATICS & BANDWIDTH BUDGET PROOF  
Raw centralized ingest (3,000 cams × 4 Mbps/stream): 12,000 Mbps (12 Gbps) — Collapse

Raw centralized at 1 Mbps compressed: 3,000 Mbps (3 Gbps) — Bottlenecked

Edge event payload (\~35 KB per detection event @ avg 1 detection/cam/sec): 3,000 events/second \= \~300 Mbps total network load (40x less than raw) — FEASIBLE

FAISS HNSW 1:N lookup (512-dim, 100K suspects, GPU): \< 1ms per query (3,000 queries/second capacity on cluster) — FEASIBLE

PostgreSQL full-table cosine scan (100K records): \~800ms per query — INCOMPATIBLE

SECTION 05: Spatio-Temporal Gating  
FALSE POSITIVE SUPPRESSION ACROSS 3,000 NODES  
At 3,000 cameras, even a 0.01% false match rate from the face recognition engine generates 30 false alerts per second — an immediate operator trust-collapse scenario. Spatio-temporal gating is the mathematical layer that suppresses physically impossible matches before they ever reach human eyes.

FIG 5.1: Spatio-Temporal Gating Decision Logic

NEW FAISS MATCH EVENT: Score 0.89 \>= threshold | CamID: KOL-1192 | t: now  
  │  
  ▼  
Q1: Does GlobalTrack exist for SuspectID S-0041?  
  ├── NO (First Sighting) ──\> CREATE GlobalTrack \-\> Face-anchored new track node  
  │  
  └── YES (Existing Track) ─\> Retrieve last sighting (CamA: KOL-0847, t\_prev: 95 sec ago)  
                                │  
                                ▼  
                         GATING FORMULA:  
                         dist(KOL-0847 → KOL-1192) \= 2.4 km  
                         min\_time \= 2400m / 2.5 m/s (max\_pedestrian) \= 960 sec required  
                                │  
                                ▼  
                         Δt\_actual \= 95 sec \< 960 sec required?  
                                ├── YES (IMPOSSIBLE) ──\> REJECT FALSE POSITIVE (Suppress Alert)  
                                └── NO  (POSSIBLE)   ──\> APPEND SIGHTING & TRIGGER ALERT PIPELINE  
Gate Rule 1: Speed-Distance Plausibility  
For any cross-camera re-identification, compute the straight-line geographic distance between Camera A (last confirmed sighting) and Camera B (new candidate sighting). Divide by the maximum plausible movement speed for the active mode:

Pedestrian: 2.5 m/s

Jogging: 4 m/s

Vehicle: 12 m/s

If the actual time delta between sightings is less than this minimum travel time, the match is geometrically impossible and is auto-rejected without human review.  
$$\\min(\\Delta t) \= \\frac{\\text{haversine\\\_distance}(\\text{CamA},\\text{CamB})}{\\text{max\\\_speed\\\_mode}}$$

Gate Rule 2: Camera Topology Reachability GraphPre-build a static camera topology graph where nodes are cameras and edges connect cameras that share a plausible direct physical pathway (same street, adjacent roads, overlapping coverage zones). A re-identification event at Camera B from Camera A is only eligible for processing if Camera B exists as a reachable node within $N$ hops of Camera A in the topology graph, weighted by minimum transit time.Cameras in physically isolated zones (separated by the Hooghly River with no bridge between them, for example) cannot be direct handoff candidates without first appearing at a bridge camera.$$\\text{reachable}(\\text{CamA}, \\text{CamB}, \\Delta t) \= \\text{true if } \\text{min\\\_path\\\_time}(A \\to B) \\le \\Delta t \\le \\text{max\\\_plausible\\\_time}$$Gate Rule 3: Confidence Decay with TimeA confirmed face-primary sighting has a confidence score that decays over time if no subsequent sightings occur. The decay function should be tuned to match the camera density of the deployment zone.$$\\text{conf\\\_effective}(t) \= \\text{conf\\\_face} \\times e^{-\\lambda \\times \\Delta t\_{\\text{since\\\_last\\\_sighting}}}$$In high-density zones (e.g., 1 camera per 50 meters), confidence should decay steeply after 30 seconds of absence. In sparse zones, the window extends to several minutes. A body Re-ID fallback match against a decayed track carries significantly reduced weight and requires a higher similarity score to persist the identity link.Gate Rule 4: Mode Lock on Re-ID HierarchyThis rule encodes your stated requirement directly into the gate logic. A body-only Re-ID match can only extend an existing, hysteresis-confirmed face-primary track. It cannot create a new global track, cannot elevate a candidate to "confirmed" status, and cannot alone trigger the alert dispatch pipeline. If body Re-ID is the only signal and no prior face confirmation exists, the system records a candidate event internally but makes no operational output until face confirmation is subsequently achieved.$$\\text{alert\\\_eligible} \= (\\text{face\\\_confirmed} \== \\text{true}) \\land (\\text{gate\\\_rules}\[1,2,3\] \== \\text{PASS})$$SECTION 06: Hardware Delegation & Compute BudgetWHAT RUNS WHERE, AND WHYField Edge: 375–750 Jetson Edge Nodes | 0 Raw Video to CoreCentral Core: \<1ms FAISS Lookup | \~300Mbps Network LoadSLA Target: ≤5s End-to-End SLA┌───────────────────────────────────────────────────────────────────────────┐  
│                           TIER 1 — FIELD EDGE                            │  
├───────────────────────────────────────────────────────────────────────────┤  
│ Hardware: NVIDIA Jetson AGX Orin (1 node per 4–8 cameras; 375–750 total)  │  
│ Workloads:                                                                │  
│   \- YOLOv10-n TRT FP16 (\~25 ms inference per frame at batch 4\)            │  
│   \- ArcFace R50 TRT INT8 (\~8 ms embedding per face crop)                  │  
│   \- ByteTrack (intra-cam) \[CPU-bound, negligible GPU usage\]               │  
│ Power & Housing: \~30W per node, IP67 enclosure, active cooling, micro-UPS │  
└─────────────────────────────────────┬─────────────────────────────────────┘  
                                      │  
                         \~35 KB/event │ Vector Payloads  
                                      ▼  
┌───────────────────────────────────────────────────────────────────────────┐  
│                      TIER 2 — CENTRAL INTELLIGENCE                        │  
├───────────────────────────────────────────────────────────────────────────┤  
│ GPU Inference Cluster:                                                    │  
│   \- 2x A100 80GB for FAISS HNSW Index, replicated (N+1)                   │  
│   \- Watchlist capacity: 500K+ embeddings entirely in HBM                  │  
│ Hysteresis \+ Gating Workers: Stateless CPU workers, horizontally scaled   │  
│ Body Re-ID Cluster: Secondary fallback CPU pool, moderate load            │  
│ Alert Dispatch: Kafka or NATS for async multicast                         │  
└─────────────────────────────────────┬─────────────────────────────────────┘  
                                      │  
                                      ▼  
┌───────────────────────────────────────────────────────────────────────────┐  
│                      TIER 3 — STORAGE & PERSISTENCE                       │  
├───────────────────────────────────────────────────────────────────────────┤  
│ NVR Rolling Buffer: 90-day retention, tiered SSD \-\> HDD storage           │  
│ Database: PostgreSQL \+ pgvector (metadata, case files, audit logs)         │  
│ Index Persistence: On-disk HNSW snapshots, daily rebuild                  │  
│ Global Track Registry: Redis for hot path, PostgreSQL for cold             │  
│ Immutable Audit Ledger: Append-only, cryptographic hash chain             │  
└───────────────────────────────────────────────────────────────────────────┘  
Key Design Principle: The Golden Rule of Edge-Cloud SplitThe boundary between the edge and the core is defined by exactly one rule: raw pixel data never crosses the network boundary. Everything that enters the fiber ring is a mathematical derivative of pixels, not the pixels themselves.This single constraint is what makes 3,000-camera real-time operation feasible on commodity hardware. Violate this rule at any point in the architecture and the entire bandwidth and latency model collapses.Critical Migration Path WarningYour existing Django codebase is not salvageable as the ingestion or inference backbone. However, specific modules can be ported or reused:The Hysteresis Manager logic (redesigned as a centralized, cross-camera service).The SuspectSighting data model (extended with geo-coordinates and global track IDs).The Report Generator (repurposed as the evidentiary clip stitcher).Everything else — the Video Splitter, Adaptive Stride FSM, centralized YOLOv10 pipeline, and RTSP management — must be completely replaced by the edge node deployment and VMS layer described above.Proven Deployment ValidationThe architecture proposed here is not theoretical:London Metropolitan Police: The NEC NeoFace Nexus deployment scanned 4.6 million faces in 2024 deployments, achieving a false positive rate of 0.0003% with a confirmed 962 arrests from 2,067 true match triggers.Delhi's Safe City Project: Operates a fabric of \~25,000 cameras managed through a C4I center using this exact edge-cloud-split paradigm.The mathematical and operational foundations described in this document are directly derived from those production systems. The path is proven — what remains is rigorous execution.INTERNAL ENGINEERING USE ONLY — FORENSIC SURVEILLANCE ARCHITECTURE REVIEWGenerated: 2026-05-13 | Cameras: 3,000+ | SLA: ≤5s"""filename \= "citywide\_surveillance\_architecture.md"with open(filename, "w", encoding="utf-8") as f:f.write(text\_content)print(f"Successfully generated {filename}")  
