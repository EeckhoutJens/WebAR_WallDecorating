window.gltfLoader = new THREE.GLTFLoader();
window.gltfLoader.setPath('3D/');
window.objectLoader = new THREE.ObjectLoader();
import {XREstimatedLight} from "./XREstimatedLight.js";

class Reticle extends THREE.Object3D {
    constructor() {
        super();

        this.loader = new THREE.GLTFLoader();
        this.loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", (gltf) => {
            this.add(gltf.scene);
        })

        this.visible = false;
    }
}

//Check for WebXR Support
(async function() {
    const isArSessionSupported =
        navigator.xr &&
        navigator.xr.isSessionSupported &&
        await navigator.xr.isSessionSupported("immersive-ar");
    if (isArSessionSupported) {
        document.getElementById("enter-ar").addEventListener("click", window.app.activateXR)
    }
})();

//Global variables (Should try to get rid of these)
const WallPoints = [];
const WallPlanePoints = [];
const WallLines = [];
const WallPlanes = [];
const UsedClippingPlanesWallFrames = [];
const PlaneHelpers = [];

const WallframePoints = [];
const WallframePlanes = [];
const WallframeLines = [];

const DoorPoints = [];
const DoorPlanes = [];
const DoorLines = [];

const SpawnedCeilingTrims = [];
const SpawnedFloorTrims = [];
const SpawnedWallTrims = [];
const ConnectedWallTrims = [];
const ConnectedWallframes =[];
let TrimsToMove = [];
let FrameToMove;
let DecoToMove;
let IsMovingDeco;
let FtMClippingPlanes;
let SelectedClippedFrameTrims;
let ClippedFrameTrims = [];
const SpawnedDoorTrims = [];

const SetIDs = [];
const DecorationTypes =
    {
        CeilingTrim: "ceilingTrim",
        FloorTrim: "floorTrim",
        WallTrim: "wallTrim",
        Decoration: "decoration",
        Set: "set",
        FillDecoration: "fillDecoration",
        UplightTrim: "uplightTrim",
        Doortrim: "doorTrim",
        Frametrim: "frameTrim"
    }

    let decoType = DecorationTypes.Decoration;


const SetTypes =
    {
        Modern: "modern",
        Classic: "classic",
        Ornamented: "ornamented",
        Eclectisch: "eclestisch"
    }

    let setType = SetTypes.Modern;

let reticleHitTestResult;

//PLANE DETECTION
//First step, place 2 points to determine the height
let IsDeterminingHeightWalls = true;

let WallHeight = 0;

//Ensures all the dots are placed on the same Y position
let ConstrainedYPosWalls = 0;

//Second step, place points in the corners of the walls
let PlacingPointsWalls = false;
let NrOfWalls = 0;
let PlacedFirstPointWalls = false;
let TopPoint;
let BottomPoint;

let PlacingPointsWallframes = false;
let PlacingPointsDoors = false;

//Third step, if a placed point is close enough to a previous point close off and move to next step
const MinDistance = 0.1;
let FinishedPlacingWalls = false;
//-------------------------------------------------------------------------------------------------

let ModelID;
let inEditMode = false;
let selectedFrame = false;
let SpawnedDecorations = [];
let HitPlaneDirection;
let IsDirectionX = false;
let IsMoveDirectionX = false;
let CurrentFrame;
let pmremGenerator;
let all_previous_anchors = new Set();

//GUI
let defaultGui;
let transformGui;

//Default GUI parameters
let paramsWallColor = {wallColor: "#919197"}
let paramsTrimColor = {trimColor: "#919197" };
let paramsDecorationColor = {decorationColor: "#919197" };
let paramsFillPlanes = {fillPlanes: false};
let paramsVisibility = {showGuides: true};
let estimatedWallMeters = {wallMeters: 0};
let estimatedFrameMeters = {frameMeters: 0};
let trimColor;
let decorationColor;


//Transform GUI parameters
let paramsWallTrimHeight = {height: 0.5};
let paramsWallFrameWidth = {width: 0.5};
let WidthController;

let defaultEnv;
let stats = new Stats();
let previewLine;

//save certain buttons so we can easily keep track of them and manipulate them
let DoneButton;
let WallframesButton;
let DoorsButton;
let PlaceButton;
let RemoveButton;
let RemoveAllButton;
let RestartButton;
let EditButton;
let SelectButton;

//Container class to handle WebXR logic
//Adapted from the AR with WebXR workshop project by Google
class App {

    SetModelID(id, type)
    {
        ModelID = id;

        if (type === "ceilingTrim")
            decoType = DecorationTypes.CeilingTrim;
        if (type === "floorTrim")
            decoType = DecorationTypes.FloorTrim;
        if (type === "wallTrim")
            decoType = DecorationTypes.WallTrim;
        if (type === "decoration")
            decoType = DecorationTypes.Decoration;
        if (type === "uplightTrim")
            decoType = DecorationTypes.UplightTrim;
        if (type === "set")
        {
            decoType = DecorationTypes.Set;
            if (id === "modern")
                setType = SetTypes.Modern;
            if (id === "classic")
                setType = SetTypes.Classic;
            if (id === "ornamented")
                setType = SetTypes.Ornamented;
            if (id === "eclestisch")
                setType = SetTypes.Eclectisch;
            this.assignSetIDs();
        }
        if (type === "fillDecoration")
            decoType = DecorationTypes.FillDecoration;
        if (type === "doorTrim")
            decoType = DecorationTypes.Doortrim;
        if (type === "frameTrim")
            decoType = DecorationTypes.Frametrim;


        let preview;
        if (decoType !== DecorationTypes.Set)
        {
            window.gltfLoader.setPath('3D/');
            window.gltfLoader.load(id + '.gltf', (gltf) => {
                let scene = gltf.scene;
                scene.traverse((child) => {
                    if (child.isMesh)
                    {
                        preview = child.parent;
                        this.scene.remove(this.reticle);

                        if (decoType !== DecorationTypes.Decoration &&
                        decoType !== DecorationTypes.FillDecoration)
                        {
                            let currScale = preview.scale;
                            currScale.x /= 2
                            preview.scale.set(currScale.x,currScale.y,currScale.z);
                        }

                        this.reticle = preview;
                        this.scene.add(this.reticle);
                    }
                })
            })
        }
        else
        {
            this.scene.remove(this.reticle);
            this.reticle = new Reticle();
            this.scene.add(this.reticle);
        }
    }

    assignSetIDs()
    {
        SetIDs.length = 0;
        switch (setType)
        {
            case SetTypes.Modern:
                SetIDs.push("C393");
                SetIDs.push("SX181");
                SetIDs.push("P6020");
                break;

            case SetTypes.Classic:
                SetIDs.push("C341");
                SetIDs.push("P8020");
                SetIDs.push("SX118");
                break;

            case SetTypes.Ornamented:
                SetIDs.push("P7030");
                SetIDs.push("C338A");
                SetIDs.push("SX118");
                break;

            case SetTypes.Eclectisch:
                SetIDs.push("C422");
                SetIDs.push("SX118");
                SetIDs.push("P8020");
                break;
        }
    }

    //General UI functions
    openNav() {
        document.getElementById("mySidenav").style.width = "250px";
        defaultGui.hide();
        PlaceButton.style.display = "none";
        RestartButton.style.display = "none";
        EditButton.style.display = "none";
    }

    closeNav() {
        document.getElementById("mySidenav").style.width = "0";
        defaultGui.show();
        PlaceButton.style.display = "block";
        RestartButton.style.display = "block";
        EditButton.style.display = "block";
    }

    openSub(id)
    {
        if (document.getElementById(id).style.display === "none")
            document.getElementById(id).style.display = "block";
        else
            document.getElementById(id).style.display = "none";

    }

    //Separate clip function for doortrims and frames using diagonal clipplanes
    DoorClip(plane,object,clipNormal,createHelper)
    {
        //Now we transform our plane into a 2D plane so we can actually use it to clip
        var normal = new THREE.Vector3();
        var point = new THREE.Vector3();

        normal.copy(clipNormal);
        normal.applyQuaternion( plane.quaternion );
        point.copy( plane.position );
        var clipPlane =  new THREE.Plane();

        clipPlane.setFromNormalAndCoplanarPoint(normal,point);

        let clippingPlane = [clipPlane.clone()];

        if (createHelper)
        {
            let test = new THREE.PlaneHelper(clippingPlane[0],2,0x0000ff )
            this.scene.add(test);
            PlaneHelpers.push(test);
        }

        object.traverse((child) => {
            if(child.isMesh) {
                child.material = child.material.clone();
                if (child.material.clippingPlanes === null)
                    child.material.clippingPlanes = clippingPlane;

                else
                    child.material.clippingPlanes.push(clippingPlane[0]);
            }
        })
    }

    ResetHelpers()
    {
        for(let i = 0; i < PlaneHelpers.length; ++i)
        {
            this.scene.remove(PlaneHelpers[i]);
        }
        PlaneHelpers.length = 0;
    }

    ClipToLength(startPos, object, length, clipNormal, createHelper)
    {
        let clippingPlane = [new THREE.Plane(clipNormal,startPos + length)];

        if (createHelper)
        {
            let test = new THREE.PlaneHelper(clippingPlane[0],2,0x0000ff )
            this.scene.add(test);
        }

        object.traverse((child) => {
            if(child.isMesh) {
                child.material = child.material.clone();
                if (child.material.clippingPlanes === null)
                    child.material.clippingPlanes = clippingPlane;

                else
                child.material.clippingPlanes.push(clippingPlane[0]);
            }
        })
    }

    ResetClipPlanes(object)
    {
        object.traverse((child) => {
            if (child.isMesh) {
                //child.material = child.material.clone();
                if (child.material.clippingPlanes !== null)
                    child.material.clippingPlanes = null;
            }
        })
    }

    /**
     * Run when the Start AR button is pressed.
     */

    activateXR = async () => {
        try {
            /** initialize a WebXR session using extra required features. */
            this.xrSession = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ['hit-test', 'dom-overlay', 'anchors', 'light-estimation'],
                domOverlay: { root: document.body }
            });

            /** Create the canvas that will contain our camera's background and our virtual scene. */
            this.createXRCanvas();

            /** With everything set up, start the app. */
            await this.onSessionStarted();

            /** Remove AR button */
            document.getElementById("enter-ar").remove();
        } catch(e) {
            console.log(e);
        }
    }

    /**
     * Add a canvas element and initialize a WebGL context that is compatible with WebXR.
     */
    createXRCanvas() {
        this.canvas = document.createElement("canvas");
        document.body.appendChild(this.canvas);
        this.gl = this.canvas.getContext("webgl", {xrCompatible: true});

        this.xrSession.updateRenderState({
            baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
        });
    }

    /**
     * Called when the XRSession has begun. Here we set up our three.js
     * renderer, scene, and camera and attach our XRWebGLLayer to the
     * XRSession and kick off the render loop.
     */
    onSessionStarted = async () => {
        /** Add the `ar` class to our body, which will hide our 2D components. */
        document.body.classList.add('ar');

        /** Setup an XRReferenceSpace using the "local" coordinate system. */
        this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

        /** Create another XRReferenceSpace that has the viewer as the origin. */
        this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');

        /** Perform hit testing using the viewer as origin. */
        this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

        /** Start a rendering loop using this.onXRFrame. */
        this.xrSession.requestAnimationFrame(this.onXRFrame);

        document.getElementById("StabilizationGif").style.display = "block";

        this.xrSession.addEventListener("select", this.onSelect);

        /** To help with working with 3D on the web, we'll use three.js. */
        this.setupThreeJs();

    }

    /**
     * Called on the XRSession's requestAnimationFrame.
     * Called with the time and XRPresentationFrame.
     */
    onXRFrame = (time, frame) => {
        /** Store current frame*/
        CurrentFrame = frame;

        /** Queue up the next draw request. */
        this.xrSession.requestAnimationFrame(this.onXRFrame);

        /** Bind the graphics framebuffer to the baseLayer's framebuffer. */
        const framebuffer = this.xrSession.renderState.baseLayer.framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
        this.renderer.setFramebuffer(framebuffer);

        /** Retrieve the pose of the device.
         * XRFrame.getViewerPose can return null while the session attempts to establish tracking. */
        const pose = frame.getViewerPose(this.localReferenceSpace);
        if (pose) {
            /** In mobile AR, we only have one view. */
            const view = pose.views[0];

            const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
            this.renderer.setSize(viewport.width, viewport.height)

            /** Use the view's transform matrix and projection matrix to configure the THREE.camera. */
            this.camera.matrix.fromArray(view.transform.matrix)
            this.camera.projectionMatrix.fromArray(view.projectionMatrix);
            this.camera.updateMatrixWorld(true);
            //
            //   /** Conduct hit test. */
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);

            //
            //   /** If we have results, consider the environment stabilized. */
            if (!this.stabilized && hitTestResults.length > 0) {
                this.stabilized = true;
                document.getElementById("StabilizationGif").style.display = "none";
                document.getElementById("HeightIcon").style.display = "block";
            }
            if (hitTestResults.length > 0) {
                let hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

                /** Update the reticle position. */
                reticleHitTestResult = hitTestResults[0];
                this.reticle.visible = true;
                this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
                this.reticle.updateMatrixWorld(true);

                this.UpdateReticleOrientation();
            }

            this.DrawPreviewlineWall();

            this.DrawPreviewlineFrame();

            this.DrawPreviewlineDoor();

            this.UpdateAnchors(frame);

            /** Render the scene with THREE.WebGLRenderer. */
            this.renderer.render(this.scene, this.camera)
        }
    }

    UpdateReticleOrientation()
    {
        //Align reticle with wall
        if (FinishedPlacingWalls)
        {
            for (let currPlane = 0; currPlane < WallPlanePoints.length; ++currPlane)
            {
                if (this.IsInSpecificPlane(this.reticle.position,WallPlanePoints[currPlane]))
                {
                    let currentPoints = WallPlanePoints[currPlane];
                    let direction = this.CalculatePlaneDirection(currentPoints[0],currentPoints[3]);
                    if (IsDirectionX)
                    {
                        if (direction.x < 0)
                            this.reticle.rotation.y = Math.PI;
                        else
                            this.reticle.rotation.y = 0;
                    }
                    else
                    {
                        if (direction.z < 0)
                            this.reticle.rotation.y = Math.PI / 2;
                        else
                            this.reticle.rotation.y = -Math.PI / 2;
                    }
                    break;
                }
            }


            //If user has a decoration selected, update it based on reticle
            if (IsMovingDeco)
            {
                if (DecoToMove)
                {
                    DecoToMove.position.set(this.reticle.position.x,this.reticle.position.y,this.reticle.position.z);
                    DecoToMove.rotation.y = this.reticle.rotation.y;
                }
            }
        }
    }

    UpdateAnchors(frame)
    {
        // only update the object's position if it's still in the list
        // of frame.trackedAnchors
        // Update the position of all the anchored objects based on the currently reported positions of their anchors
        const tracked_anchors = frame.trackedAnchors;
        if(tracked_anchors){
            tracked_anchors.forEach(anchor => {
                const anchorPose = frame.getPose(anchor.anchorSpace, this.localReferenceSpace);
                if (anchorPose)
                {
                    for (let currObj = 0; currObj < anchor.context.sceneObject.length; ++currObj)
                    {
                        anchor.context.sceneObject[currObj].matrix.fromArray(anchorPose.transform.matrix);
                    }
                }
                else
                {
                    for (let currObj = 0; currObj < anchor.context.sceneObject.length; ++currObj)
                    {
                        anchor.context.sceneObject[currObj].visible = false;
                    }
                }
            });

            all_previous_anchors = tracked_anchors;
        }
        else {


            all_previous_anchors = new Set();
        }
    }

    DrawPreviewlineWall()
    {
        //Draw preview lines while placing points to define walls
        if (PlacingPointsWalls && WallPoints.length !== 0)
        {
            this.scene.remove(previewLine);
            let PreviewPoints = [];
            let InitialPos = new THREE.Vector3(0,0,0);
            InitialPos.copy(this.reticle.position);
            InitialPos.y = ConstrainedYPosWalls;
            PreviewPoints.push(InitialPos);
            TopPoint = InitialPos;

            let adjustedPos = new THREE.Vector3(0,0,0);
            adjustedPos.copy(this.reticle.position);
            adjustedPos.y = ConstrainedYPosWalls - WallHeight;
            PreviewPoints.push(adjustedPos);
            BottomPoint = adjustedPos;

            let copiedPos1 = new THREE.Vector3(0,0,0);
            let copiedPos2 = new THREE.Vector3(0,0,0);
            let arrLength = WallPoints.length;

            copiedPos1.copy(WallPoints[arrLength - 1].position);
            copiedPos2.copy(WallPoints[arrLength - 2].position);

            let direction = new THREE.Vector3(0,0,0);
            direction.copy(BottomPoint);
            direction.sub(copiedPos1);
            let isDirectionX = Math.abs(direction.x) > Math.abs(direction.z);

            if (isDirectionX)
            {
                TopPoint.z = copiedPos1.z;
                BottomPoint.z = copiedPos1.z;
            }
            else
            {
                TopPoint.x = copiedPos1.x;
                BottomPoint.x = copiedPos1.x;
            }

            PreviewPoints.push(copiedPos1);
            PreviewPoints.push(copiedPos2);
            PreviewPoints.push(InitialPos);

            const material = new THREE.LineBasicMaterial({color: 0x0000ff});
            const geometry = new THREE.BufferGeometry().setFromPoints(PreviewPoints);
            const line = new THREE.Line(geometry,material);
            this.scene.add(line);
            previewLine = line;
        }
    }

    DrawPreviewlineFrame()
    {
        //Draw preview lines while placing points to define WallFrames
        if (PlacingPointsWallframes && WallframePoints.length !== 0)
        {
            this.scene.remove(previewLine);
            let previewPoints = [];
            let InitialPos = new THREE.Vector3(0,0,0);
            let LTPoint = new THREE.Vector3(0,0,0);
            let BRPoint = new THREE.Vector3(0,0,0);
            InitialPos.copy(this.reticle.position);

            //CODE TO TEST ON FLAT PLAINS - REMOVE FOR PROPER TESTING
            //InitialPos.y = 0.5;

            LTPoint.copy(WallframePoints[0].position);
            LTPoint.y = InitialPos.y;

            this.CalculatePlaneDirection(WallframePoints[0].position,InitialPos);
            if (IsDirectionX)
            {
                InitialPos.z = WallframePoints[0].position.z;
            }
            else
            {
                InitialPos.x = WallframePoints[0].position.x;
            }

            BRPoint.copy(InitialPos);
            BRPoint.y = WallframePoints[0].position.y;

            TopPoint = InitialPos;

            previewPoints.push(BRPoint);
            previewPoints.push(InitialPos);
            previewPoints.push(LTPoint);
            previewPoints.push(WallframePoints[0].position);

            const material = new THREE.LineBasicMaterial({color: 0xff0000});
            const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
            const line = new THREE.Line(geometry,material);
            this.scene.add(line);
            previewLine = line;
        }
    }

    DrawPreviewlineDoor()
    {
        //Draw preview lines while placing points to define WallFrames
        if (PlacingPointsDoors && DoorPoints.length !== 0)
        {
            this.scene.remove(previewLine);
            let previewPoints = [];
            let InitialPos = new THREE.Vector3(0,0,0);
            let LTPoint = new THREE.Vector3(0,0,0);
            let BRPoint = new THREE.Vector3(0,0,0);
            InitialPos.copy(this.reticle.position);

            //CODE TO TEST ON FLAT PLAINS - REMOVE FOR PROPER TESTING
            //InitialPos.y = 0.5;

            LTPoint.copy(DoorPoints[0].position);
            LTPoint.y = InitialPos.y;

            this.CalculatePlaneDirection(DoorPoints[0].position,InitialPos);
            if (IsDirectionX)
            {
                InitialPos.z = DoorPoints[0].position.z;
            }
            else
            {
                InitialPos.x = DoorPoints[0].position.x;
            }

            BRPoint.copy(InitialPos);
            BRPoint.y = DoorPoints[0].position.y;

            TopPoint = InitialPos;

            previewPoints.push(BRPoint);
            previewPoints.push(InitialPos);
            previewPoints.push(LTPoint);
            previewPoints.push(DoorPoints[0].position);

            const material = new THREE.LineBasicMaterial({color: 0x00ff00});
            const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
            const line = new THREE.Line(geometry,material);
            this.scene.add(line);
            previewLine = line;
        }
    }

    /**
     * Initialize three.js specific rendering code, including a WebGLRenderer,
     * a demo scene, and a camera for viewing the 3D content.
     */

    setupThreeJs() {
        /** To help with working with 3D on the web, we'll use three.js.
         * Set up the WebGLRenderer, which handles rendering to our session's base layer. */
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
            canvas: this.canvas,
            context: this.gl
        });

        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.localClippingEnabled = true;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.xr = this.xrSession;
        this.renderer.xr.enabled = true;

        /** Initialize our demo scene. */
        const scene = new THREE.Scene();

        //Create default lights that we can fall back on if light estimation does not work
        //or  is not supported
        const light = new THREE.AmbientLight(0x222222);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.castShadow = true;
        directionalLight.position.set(0, 1, 0.75).normalize();

        //Create xrLight to enable light estimation
        const xrLight = new XREstimatedLight(this.renderer);
        xrLight.castShadow = true;

        //Set up light estimation event listeners
        xrLight.addEventListener('estimationstart',() =>{
            console.log("Started light estimation");
            this.scene.add(xrLight);
            this.scene.remove(light);
            this.scene.remove(directionalLight);
            if (xrLight.environment)
            {
                scene.environment = xrLight.environment;
            }
        });

        xrLight.addEventListener('estimationend', () =>{
            console.log("Ended light estimation");
            this.scene.remove(xrLight);
            this.scene.environment = defaultEnv;
            this.scene.add(light);
            this.scene.add(directionalLight);
        })

        // Make a large plane to receive our shadows
        const planeGeometry = new THREE.PlaneGeometry(2000, 2000);

        // Rotate our plane to be parallel to the floor
        planeGeometry.rotateX(-Math.PI / 2);

        // Create a mesh with a shadow material, resulting in a mesh
        // that only renders shadows once we flip the `receiveShadow` property.
        const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
            color: 0x111111,
            opacity: 0.2,
        }));

        // Give it a name so we can reference it later, and set `receiveShadow`
        // to true so that it can render our model's shadow.
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10000;

        this.scene = scene;
        this.reticle = this.CreateSphere();
        this.scene.add(this.reticle);
        this.scene.add(shadowMesh);

        /** We'll update the camera matrices directly from API, so
         * disable matrix auto updates so three.js doesn't attempt
         * to handle the matrices independently. */
        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
    }

    UpdateTrimColor()
    {
        trimColor = new THREE.Color(paramsTrimColor.trimColor);
        for(let currTrim = 0; currTrim < SpawnedCeilingTrims.length; ++currTrim)
        {
        SpawnedCeilingTrims[currTrim].traverse((child) => {
            if (child.isMesh)
            {
                child.material.color.set(trimColor);
            }
            })
        }

        for(let currTrim = 0; currTrim < SpawnedFloorTrims.length; ++currTrim)
        {
            SpawnedFloorTrims[currTrim].traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                }
            })

        }

        for(let currConnectedTrim = 0; currConnectedTrim < ConnectedWallTrims.length; ++currConnectedTrim)
        {
            let trims = ConnectedWallTrims[currConnectedTrim];
            for (let currTrim = 0; currTrim < trims.length; ++currTrim)
            {
                trims[currTrim].traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                    }
                })
            }

        }

        for (let currWallFrame = 0; currWallFrame < ConnectedWallframes.length; ++currWallFrame)
        {
            let frame = ConnectedWallframes[currWallFrame];
            for (let currTrim = 0; currTrim < frame.children.length; ++currTrim)
            {
                frame.children[currTrim].traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                    }
                })
            }
        }

        for (let currTrim = 0; currTrim < SpawnedDoorTrims.length; ++currTrim)
        {
            SpawnedDoorTrims[currTrim].traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                }
            })
        }
    }

    UpdateDecorationColor()
    {
        decorationColor = new THREE.Color(paramsDecorationColor.decorationColor);
        for(let currTrim = 0; currTrim < SpawnedDecorations.length; ++currTrim)
        {
            SpawnedDecorations[currTrim].traverse((child) => {
                if (child.isMesh)
                {
                    child.material.color.set(decorationColor);
                }
            })
        }
    }

    UpdateGuideVisibility()
    {
        let isActive = paramsVisibility.showGuides;

            for (let currentPoint = 0; currentPoint < WallPoints.length; ++currentPoint)
            {
                WallPoints[currentPoint].visible = isActive;
            }

            for (let currentLine = 0; currentLine < WallLines.length; ++currentLine)
            {
                WallLines[currentLine].visible = isActive;
            }

        for (let currentPoint = 0; currentPoint < WallframePoints.length; ++currentPoint)
        {
            WallframePoints[currentPoint].visible = isActive;
        }

        for (let currentLine = 0; currentLine < WallframeLines.length; ++currentLine)
        {
            WallframeLines[currentLine].visible = isActive;
        }

        for (let currentPoint = 0; currentPoint < DoorPoints.length; ++currentPoint)
        {
            DoorPoints[currentPoint].visible = isActive;
        }

        for (let currentLine = 0; currentLine < DoorLines.length; ++currentLine)
        {
            DoorLines[currentLine].visible = isActive;
        }
    }

    UpdatePlaneFill()
    {
        for (let currentPlane = 0; currentPlane < WallPlanes.length; ++currentPlane)
        {
            WallPlanes[currentPlane].visible = paramsFillPlanes.fillPlanes;
        }
    }

    UpdateWallColor()
    {
        let WallColor = new THREE.Color(paramsWallColor.wallColor);

        for (let i = 0; i < WallPlanes.length; ++i)
        {
            WallPlanes[i].material.color.set(WallColor);
        }
    }

    /** Place a point when the screen is tapped.
     * Once 2 or more points have been placed create lines*/
    onSelect = (event) =>
    {
        if (!FinishedPlacingWalls)
            this.HandleWallSelection(event);

        if (PlacingPointsWallframes)
            this.HandleWallframeSelection(event);

        if (PlacingPointsDoors)
            this.HandleDoorSelection(event);
    }

    CalculateWallMeters()
    {
        for (let currPlane = 0; currPlane < WallPlanePoints.length; ++currPlane)
        {
            let currPoints = WallPlanePoints[currPlane];
            let distance = currPoints[1].distanceTo(currPoints[2]);
            estimatedWallMeters.wallMeters += Math.abs(distance);
        }
    }

    HandleWallSelection(event)
    {
        if (PlacingPointsWalls)
        {
                if (WallPoints.length !== 0)
                {
                    let distanceToMarker = WallPoints[WallPoints.length - 1].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < MinDistance)
                    {
                        FinishedPlacingWalls = true;
                        PlacingPointsWalls = false;
                        this.scene.remove(previewLine);
                        previewLine = null;
                        this.CreatePlanes();
                        this.CalculateWallMeters();
                        this.CreateDoneButton();
                        this.CreateSelectWallframesButton();
                        this.CreateSelectDoorsButton();
                        document.getElementById("WallsIcon").style.display = "none";
                    }

                    distanceToMarker = WallPoints[1].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < MinDistance)
                    {
                        let Point1;
                        let FirstLocation = new THREE.Vector3(0,0,0);
                        FirstLocation.copy(TopPoint);
                        Point1 = this.CreateSphere(FirstLocation);

                        let SecondLocation = new THREE.Vector3(0,0,0);
                        SecondLocation.copy(FirstLocation);
                        SecondLocation.y = ConstrainedYPosWalls - WallHeight;
                        let Point2 = this.CreateSphere(SecondLocation);

                        //Code adapted from anchor example https://github.com/immersive-web/webxr-samples/blob/main/anchors.html
                        let frame = event.frame;
                        let anchorPoseP2 = new XRRigidTransform(Point2.position,{x: 0,y: 0,z: 0,w: 1});

                        frame.createAnchor(anchorPoseP2,this.localReferenceSpace).then((anchor) =>
                        {
                            anchor.context = {};
                            anchor.context.sceneObject = [];
                            anchor.context.sceneObject.push(Point2);
                            anchor.context.sceneObject.push(Point1);
                            Point2.anchor = anchor;
                            Point1.anchor = anchor;

                            WallPoints.push(Point1);
                            WallPoints.push(Point2);

                            if (WallPoints.length >= 4)
                            {
                                ++NrOfWalls;
                            }
                            this.CreatePlanes();
                            this.CalculateWallMeters();
                        })
                            this.CreateDoneButton();
                            this.CreateSelectWallframesButton();
                            this.CreateSelectDoorsButton();
                            document.getElementById("WallsIcon").style.display = "none";

                        FinishedPlacingWalls = true;
                        PlacingPointsWalls = false;
                        let test = previewLine.clone();
                        this.scene.remove(previewLine);
                        this.scene.add(test);
                        WallLines.push(test);
                        previewLine = null;

                    }
                }

                let Point1;
                let Point2;
                let FirstLocation = new THREE.Vector3(0,0,0);
                FirstLocation.copy(this.reticle.position);
                FirstLocation.y = ConstrainedYPosWalls;

                //Used to ensure that the else code doesn't execute when placing first point
                if (!PlacedFirstPointWalls)
                {
                    PlacedFirstPointWalls = true;
                }


                if (TopPoint)
                    Point1 = this.CreateSphere(TopPoint);
                else
                    Point1 = this.CreateSphere(FirstLocation);


                let SecondLocation = new THREE.Vector3(0,0,0);
                SecondLocation.copy(FirstLocation);
                SecondLocation.y = ConstrainedYPosWalls - WallHeight;

                if (BottomPoint)
                 Point2 = this.CreateSphere(BottomPoint);
                else
                    Point2 = this.CreateSphere(SecondLocation);


            //Code adapted from anchor example https://github.com/immersive-web/webxr-samples/blob/main/anchors.html
            let frame = event.frame;
            let anchorPoseP2 = new XRRigidTransform(Point2.position,{x: 0,y: 0,z: 0,w: 1});

            frame.createAnchor(anchorPoseP2,this.localReferenceSpace).then((anchor) =>
            {
                anchor.context = {};
                anchor.context.sceneObject = [];
                anchor.context.sceneObject.push(Point2);
                anchor.context.sceneObject.push(Point1);
                Point2.anchor = anchor;
                Point1.anchor = anchor;

                WallPoints.push(Point1);
                WallPoints.push(Point2);

                if (WallPoints.length >= 4)
                {
                    ++NrOfWalls;
                }
            })

                if (WallPoints.length > 0)
                {
                    let test = previewLine.clone();
                    this.scene.remove(previewLine);
                    this.scene.add(test);
                    WallLines.push(test);
                    previewLine = null;
                }
        }

        if (IsDeterminingHeightWalls)
        {
            let createdSphere = this.CreateSphere(this.reticle.position);

            reticleHitTestResult.createAnchor().then((anchor) =>
            {
                anchor.context = {};
                createdSphere.anchor = anchor;
                anchor.context.sceneObject = [];
                anchor.context.sceneObject.push(createdSphere);
                app.scene.add(createdSphere);
                WallPoints.push(createdSphere);

                if (WallPoints.length === 2)
                {
                    ConstrainedYPosWalls = WallPoints[1].position.y;

                    //DELETE - Just added it now for testing purposes
                    //ConstrainedYPosWalls = 1.75;

                    WallHeight = ConstrainedYPosWalls - WallPoints[0].position.y;
                    this.ResetWallPoints();
                    IsDeterminingHeightWalls = false;
                    PlacingPointsWalls = true;
                    document.getElementById("HeightIcon").style.display = "none";
                    document.getElementById("WallsIcon").style.display = "block";
                }
            })
        }
    }

    HandleFrameSelection(event, container)
    {
        //Select bottom left - top right
        let createdSphere;
        if (container.length === 0)
        {
            createdSphere = this.CreateSphere(this.reticle.position);
        }

        else
        {
            createdSphere = this.CreateSphere(TopPoint);
        }

        let frame = event.frame;

        let anchorPose = new XRRigidTransform(createdSphere.position,{x: 0,y: 0,z: 0,w: 1});

        frame.createAnchor(anchorPose,this.localReferenceSpace).then((anchor) =>
        {
            anchor.context = {};
            anchor.context.sceneObject = createdSphere;
            createdSphere.anchor = anchor;
        })

        container.push(createdSphere);

        if (container.length === 2) {
            //Generate top left
            //container[1].position.y = 0.5;
            let topLeftPosition = container[0].position.clone();
            topLeftPosition.y = container[1].position.y;
            let topLeftSphere = this.CreateSphere(topLeftPosition);
            container.push(topLeftSphere);

            let anchorPoseTL = new XRRigidTransform(topLeftPosition, {x: 0, y: 0, z: 0, w: 1})
            frame.createAnchor(anchorPoseTL, this.localReferenceSpace).then((anchor) => {
                anchor.context = {};
                anchor.context.sceneObject = topLeftSphere;
                topLeftSphere.anchor = anchor;
            })

            //Generate bottom right
            let bottomRightPosition = container[1].position.clone();
            bottomRightPosition.y = container[0].position.y;
            let bottomRightSphere = this.CreateSphere(bottomRightPosition);
            container.push(bottomRightSphere);

            let anchorPoseBR = new XRRigidTransform(bottomRightPosition, {x: 0, y: 0, z: 0, w: 1})
            frame.createAnchor(anchorPoseBR, this.localReferenceSpace).then((anchor) => {
                anchor.context = {};
                anchor.context.sceneObject = bottomRightSphere;
                bottomRightSphere.anchor = anchor;
            })
        }
    }

    HandleWallframeSelection(event)
    {
        this.HandleFrameSelection(event,WallframePoints);
        this.DrawWallframes();
    }

    HandleDoorSelection(event)
    {
        this.HandleFrameSelection(event,DoorPoints);
        this.DrawDoors();
    }

    ResetWallPoints()
    {
        for(let i= 0; i < WallPoints.length; ++i)
        {
            this.scene.remove(WallPoints[i]);
        }
        WallPoints.length = 0;
    }

    ResetWallframePoints()
    {
        for(let i= 0; i < WallframePoints.length; ++i)
        {
            this.scene.remove(WallframePoints[i]);
        }
        WallframePoints.length = 0;
    }

    ResetDoorPoints()
    {
        for(let i= 0; i < DoorPoints.length; ++i)
        {
            this.scene.remove(DoorPoints[i]);
        }
        DoorPoints.length = 0;
    }

    ResetDoorTrims()
    {
        for (let i = 0 ; i < SpawnedDoorTrims.length; ++i)
        {
            this.scene.remove(SpawnedDoorTrims[i]);
        }
        SpawnedDoorTrims.length = 0;
    }

    ResetCeilingTrims()
    {
        for(let i= 0; i < SpawnedCeilingTrims.length; ++i)
        {
            this.scene.remove(SpawnedCeilingTrims[i]);
        }
        SpawnedCeilingTrims.length = 0;
    }

    ResetFloorTrims()
    {
        for(let i= 0; i < SpawnedFloorTrims.length; ++i)
        {
            this.scene.remove(SpawnedFloorTrims[i]);
        }
        SpawnedFloorTrims.length = 0;
    }

    ResetWallTrims()
    {
        for(let i= 0; i < ConnectedWallTrims.length; ++i)
        {
            let currTrimLine = ConnectedWallTrims[i];
            for (let j = 0; j < currTrimLine.length; ++j)
            {
                this.scene.remove(currTrimLine[j]);
            }
        }
        ConnectedWallTrims.length = 0;
    }

    ResetWallFrames()
    {
        for(let i = 0; i < ConnectedWallframes.length; ++i)
        {
            this.scene.remove(ConnectedWallframes[i]);
        }
        ConnectedWallframes.length = 0;
        UsedClippingPlanesWallFrames.length = 0;
    }

    MoveWallTrimsHeight()
    {
        if (!selectedFrame)
        {
            for (let i = 0; i < TrimsToMove.length; ++i)
            {
                TrimsToMove[i].position.y = paramsWallTrimHeight.height;
            }
        }

        else
        {
            app.ResetHelpers();
            let change = paramsWallTrimHeight.height - FrameToMove.position.y;
            FrameToMove.position.y = paramsWallTrimHeight.height;
            for (let i = 0; i < FrameToMove.children.length; ++i)
            {
                app.ResetClipPlanes(FrameToMove.children[i]);
            }
            for (let i = 0; i < FtMClippingPlanes.children.length; ++i)
            {
                FtMClippingPlanes.children[i].position.y += change;
            }
            app.ReclipFrame(FrameToMove,FtMClippingPlanes);
        }

    }

    MoveWallFrameWidth()
    {
        app.ResetHelpers();
        if (IsMoveDirectionX)
        {
            let change = paramsWallFrameWidth.width - FrameToMove.position.x;
            FrameToMove.position.x = paramsWallFrameWidth.width;
            for (let i = 0; i < FtMClippingPlanes.children.length; ++i)
            {
                FtMClippingPlanes.children[i].position.x += change;
            }
        }
        else
        {
            let change = paramsWallFrameWidth.width - FrameToMove.position.z;
            FrameToMove.position.z = paramsWallFrameWidth.width;
            for (let i = 0; i < FtMClippingPlanes.children.length; ++i)
            {
                FtMClippingPlanes.children[i].position.z += change;
            }
        }
        for (let i = 0; i < FrameToMove.children.length; ++i)
        {
            app.ResetClipPlanes(FrameToMove.children[i]);
        }
        app.ReclipFrame(FrameToMove,FtMClippingPlanes);
    }

    ResetDecorations()
    {
        for(let i= 0; i < SpawnedDecorations.length; ++i)
        {
            this.scene.remove(SpawnedDecorations[i]);
        }
        SpawnedDecorations.length = 0;
    }

    CreateSphere(position)
    {
        const sphereGeometry = new THREE.SphereGeometry(0.025,32,16);
        const sphereMaterial = new THREE.MeshBasicMaterial({color: 0xfff00});
        const sphere = new THREE.Mesh(sphereGeometry,sphereMaterial);
        if (position)
        {
            sphere.position.copy(position);
            sphere.matrixAutoUpdate = false;
        }
        this.scene.add(sphere)
        return sphere;
    }

    CreatePlanes()
    {
        let startIndex = 0;
        for(let i = 0; i < NrOfWalls; ++i)
        {
            //Add Points that define plane to array and store that array
            //LeftTop - LeftBottom - RightBottom - RightTop
            const planePoints = [];
            planePoints.push(WallPoints[startIndex].position);
            planePoints.push(WallPoints[startIndex + 1].position)
            planePoints.push(WallPoints[startIndex + 3].position)
            planePoints.push(WallPoints[startIndex + 2].position)
            WallPlanePoints.push(planePoints);
            let right = this.CalculatePlaneDirection(planePoints[1],planePoints[2])
            let up = this.CalculatePlaneDirection(planePoints[1],planePoints[0]);
            let width;
            let IsX;
            IsX = Math.abs(right.x) > Math.abs(right.z)
            if (IsX)
                width = Math.abs(right.x);
            else
                width = Math.abs(right.z);


            const geometry = new THREE.PlaneGeometry(width,up.y);

            const material = new THREE.MeshBasicMaterial( {color: 0xff0000, side: THREE.DoubleSide} );
            const plane = new THREE.Mesh( geometry, material );
            plane.position.copy(planePoints[1]);
            if (IsX)
            {
                if(right.x < 0)
                    plane.position.x -= width / 2;
                else
                    plane.position.x += width / 2;
            }

            else
            {
                plane.rotateY(Math.PI / 2);
                if (right.z < 0)
                    plane.position.z -= width / 2;
                else
                    plane.position.z += width / 2;
            }

            plane.position.y += up.y / 2;
            plane.visible = false;
            this.scene.add( plane );
            WallPlanes.push(plane);

            startIndex += 2;
        }

    }

    DrawWallframes()
    {
        this.DrawPlanes(WallframePoints,WallframeLines,WallframePlanes,0xff0000);
        this.CalculateFrameMeters(WallframePoints, false);
        this.ResetWallframePoints();
    }

    CalculateFrameMeters(points, isDoor)
    {
        //calculate distance between points 0 and 2 (x2)
        let Ydistance = points[0].position.distanceTo(points[2].position);
        //calculate distance between points 0 and 3 (x2)
        let Rdistance = points[0].position.distanceTo(points[3].position);

        if (!isDoor)
            estimatedFrameMeters.frameMeters += (Ydistance * 2) + (Rdistance * 2) ;
        else
            estimatedFrameMeters.frameMeters += (Ydistance * 2) + Rdistance;
    }

    //This function takes 3 containers, points is the only one that needs to filled before calling function
    //The other 2 will be used to store information created within this function
    DrawPlanes(points, lines, planes, lineColor)
    {
        this.scene.remove(previewLine);
        previewLine = null;
        var linePoints = [];
        linePoints.push(points[2].position.clone());
        linePoints.push(points[0].position.clone());
        linePoints.push(points[3].position.clone());
        linePoints.push(points[1].position.clone());
        linePoints.push(points[2].position.clone());

        const material = new THREE.LineBasicMaterial({color: lineColor});
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const line = new THREE.Line(geometry,material);
        this.scene.add(line);
        lines.push(line);
        linePoints.pop();
        planes.push(linePoints);
    }

    DrawDoors()
    {
        this.DrawPlanes(DoorPoints,DoorLines,DoorPlanes,0x00ff00);
        this.CalculateFrameMeters(DoorPoints, true);
        this.ResetDoorPoints();
    }

    LoadModel(position, scene)
    {
        let inPlane = this.IsInPlane(this.reticle.position);
                switch (decoType)
                {
                    case DecorationTypes.Decoration:
                        if (!inPlane)
                            return;

                        window.gltfLoader.load(ModelID + ".gltf", function (gltf) {
                            let loadedScene = gltf.scene;
                            let decoration;

                            //scenes were exported with lighting so make sure to only add mesh to the scene
                            loadedScene.traverse((child) => {
                                if(child.isMesh)
                                {
                                    child.material.color = decorationColor;
                                    decoration = child.parent;
                                }
                            });

                            decoration.position.copy(position);
                            if (IsDirectionX) {
                                if (HitPlaneDirection.x < 0)
                                    decoration.rotateY(Math.PI);
                            } else {
                                if (HitPlaneDirection.z < 0)
                                    decoration.rotateY(Math.PI / 2);
                                if (HitPlaneDirection.z > 0)
                                    decoration.rotateY(-Math.PI / 2);

                            }
                            SpawnedDecorations.push(decoration);
                            scene.add(decoration);
                        });
                        break;

                    case DecorationTypes.CeilingTrim:
                        app.GenerateCeilingTrims(ModelID);
                        break;

                    case DecorationTypes.FloorTrim:
                        app.GenerateFloorTrims(ModelID);
                        break;

                    case DecorationTypes.WallTrim:
                        app.GenerateWallTrims(ModelID);
                        break;

                    case DecorationTypes.Set:
                        app.PlaceSet();
                        break;

                    case DecorationTypes.FillDecoration:
                        app.FillPlane(ModelID);
                        break;

                    case DecorationTypes.UplightTrim:
                        app.GenerateCeilingTrims(ModelID);
                        break;

                    case DecorationTypes.Frametrim:
                        app.GenerateWallframeTrims(ModelID);
                        break;

                    case DecorationTypes.Doortrim:
                        app.GenerateDoorTrims(ModelID);
                        break;
                }
    }

    PlaceSet()
    {
        //Clear previously placed trims
        app.ResetCeilingTrims();
        app.ResetWallTrims();
        app.ResetFloorTrims()

        //Iterate over IDs in SetIDs array and place correct type of object based on ID (C - SX - P)
        for(let i = 0; i < SetIDs.length; ++i)
        {
            let currID = SetIDs[i];
            if (currID.startsWith("C"))
            {
                this.GenerateCeilingTrims(currID);
            }
            if (currID.startsWith("SX"))
            {
                this.GenerateFloorTrims(currID);
            }
            if (currID.startsWith("P"))
            {
                this.GenerateWallTrims(currID);
            }
        }
    }

    GenerateTrims(Trim, StartPosition, direction, absDirection,IsX, decoType)
    {
            let positionOffset = new THREE.Vector3(0,0,0);
            let nrToSpawn = 0;
            let length;
            let clipNormal;
            if (IsX)
                clipNormal = new THREE.Vector3(-1,0,0);
            else
                clipNormal = new THREE.Vector3(0,0,-1);

            //Initial load so we can use data to calculate additional nr of meshes we might need to load after this
                let trimToSpawn = Trim.clone();

                trimToSpawn.position.copy(StartPosition);
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0,0,0);
                box.getSize(dimensions);

                if (IsX)
                {
                    nrToSpawn = Math.ceil(absDirection.x / dimensions.x);
                    length = absDirection.x;
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = dimensions.x;
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                    }

                }
                else
                {
                    nrToSpawn = Math.ceil(absDirection.z / dimensions.x);
                    length = absDirection.z;
                    if (direction.z < 0)
                    {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = dimensions.x;
                    }
                    if (direction.z > 0)
                    {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                    }
                }

                    switch (decoType)
                    {
                        case DecorationTypes.CeilingTrim:
                            SpawnedCeilingTrims.push(trimToSpawn);
                            break;

                        case DecorationTypes.FloorTrim:
                            SpawnedFloorTrims.push(trimToSpawn);
                            break;

                        case DecorationTypes.WallTrim:
                            SpawnedWallTrims.push(trimToSpawn);
                            break;
                    }

                //Decrement nr by one seeing as we already spawned one to get the data
                --nrToSpawn;

                if (nrToSpawn <= 0)
                {
                    if (IsX)
                    {
                        app.ClipToLength(StartPosition.x,trimToSpawn ,length,clipNormal,false);
                    }
                    else
                    {
                        app.ClipToLength(StartPosition.z,trimToSpawn ,length,clipNormal,false);
                    }

                }

                if (IsX)
                    trimToSpawn.position.x += dimensions.x / 2;
                else
                    trimToSpawn.position.z += dimensions.x / 2;

                app.scene.add(trimToSpawn);

                //Now we clone enough meshes to fill up top line of plane
                for(let i = 1; i <= nrToSpawn; ++i)
                {
                        let trimToSpawn2 = Trim.clone();

                        trimToSpawn2.position.copy(StartPosition);

                        trimToSpawn2.position.addScaledVector(positionOffset,i);
                        if (IsX)
                        {
                            if (direction.x < 0)
                            {
                                trimToSpawn2.rotateY(Math.PI);
                                trimToSpawn2.position.x += dimensions.x / 2;
                            }
                            else
                            {
                                trimToSpawn2.position.x += dimensions.x / 2;
                            }

                        }
                        else
                        {
                            if (direction.z < 0)
                            {
                                trimToSpawn2.rotateY(Math.PI / 2)
                                trimToSpawn2.position.z += dimensions.x / 2;
                            }
                            if (direction.z > 0)
                            {
                                trimToSpawn2.rotateY(-Math.PI / 2)
                                trimToSpawn2.position.z += dimensions.x / 2;
                            }
                        }

                            switch (decoType)
                            {
                                case DecorationTypes.CeilingTrim:
                                    SpawnedCeilingTrims.push(trimToSpawn2);
                                    break;

                                case DecorationTypes.FloorTrim:
                                    SpawnedFloorTrims.push(trimToSpawn2);
                                    break;

                                case DecorationTypes.WallTrim:
                                    SpawnedWallTrims.push(trimToSpawn2);
                                    break;
                            }

                        if (i === nrToSpawn)
                        {
                            if (IsX)
                            {
                                if (direction.x < 0)
                                {
                                   app.ClipToLength(StartPosition.x ,trimToSpawn2 ,length,clipNormal,false);
                                }

                                else
                                    app.ClipToLength(StartPosition.x,trimToSpawn2 ,length,clipNormal,false);
                            }

                            else
                            {
                                if (direction.z < 0)
                                {
                                    app.ClipToLength(StartPosition.z,trimToSpawn2 ,length,clipNormal,false);
                                }
                                else
                                    app.ClipToLength(StartPosition.z,trimToSpawn2 ,length,clipNormal,false);
                            }
                        }
                        app.scene.add(trimToSpawn2);
                }
    }

    GenerateSlicedTrims(loadedMesh, planes,container,isDoors)
    {
        //Need to load 3 trims - left,top,right
        //1 (left), 0 (top), 2 (right)
        //Iterate over each door or keep it unique per door?
        //Needs direction (X or Z)
        for(let currentPlane = 0; currentPlane < planes.length; ++currentPlane)
        {
            let currentPoints = planes[currentPlane];
            let usedClippingPlanes = new THREE.Group();
            let clippedTrims = [];
            let trims = new THREE.Group();

            let rightDirection = this.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
            let upDirection = this.CalculatePlaneDirection(currentPoints[1],currentPoints[0]);
            let absRightDirection = new THREE.Vector3(0,0,0);
            absRightDirection.copy(rightDirection);
            absRightDirection.x = Math.abs(absRightDirection.x);
            absRightDirection.y = Math.abs(absRightDirection.y);
            absRightDirection.z = Math.abs(absRightDirection.z);
            let IsX = absRightDirection.x > absRightDirection.z;
            let box;
            let length;
            let dimensions = new THREE.Vector3(0,0,0);

            //Load left trim and get dimensions

                //Create 3D plane in order to make positioning easier
                let testPlaneGeom = new THREE.PlaneGeometry(1,1);
                const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} );
                const LTPlane = new THREE.Mesh( testPlaneGeom, material );
                const LBPlane = new THREE.Mesh(testPlaneGeom,material);

                LTPlane.position.copy(currentPoints[0]);
                LBPlane.position.copy(currentPoints[1]);
                if (IsX)
                {
                    if (rightDirection.x < 0)
                    {
                        LTPlane.rotateY(Math.PI);
                        LBPlane.rotateY(Math.PI);
                    }
                    LTPlane.rotateZ(-Math.PI / 4);
                    LBPlane.rotateZ(Math.PI / 4);


                }
                else
                {
                    if (rightDirection.z < 0)
                    {
                        LTPlane.rotateY(Math.PI);
                        LBPlane.rotateY(Math.PI);
                    }
                        LTPlane.rotateX(Math.PI / 4);
                        LBPlane.rotateX(-Math.PI / 4);

                }
                usedClippingPlanes.add(LTPlane);
                usedClippingPlanes.add(LBPlane);


                let leftTrim = loadedMesh.clone();
                box = new THREE.Box3().setFromObject(leftTrim);
                box.getSize(dimensions);

                let nrToSpawnY = Math.ceil(upDirection.y / dimensions.x)

                leftTrim.rotateZ(-Math.PI / 2);

                leftTrim.position.copy(currentPoints[1]);
                if (IsX)
                {
                    length = absRightDirection.x;
                    if (rightDirection.x < 0)
                    {
                        leftTrim.rotateX(Math.PI);
                    }
                }
                else
                {
                    length = absRightDirection.z;
                    if (rightDirection.z < 0)
                    {
                        leftTrim.rotateX(-Math.PI / 2);
                    }

                    else
                    {
                        leftTrim.rotateX(Math.PI / 2);
                    }
                }

                let nrToSpawnRight = Math.ceil(length / dimensions.x);


                leftTrim.position.y += dimensions.x / 2;
                let YClip = new THREE.Vector3(0,-1,0);
                let posYClip = new THREE.Vector3(0,1,0);

                trims.add(leftTrim);

                if (!isDoors)
                    app.DoorClip(LBPlane,leftTrim,posYClip,false);

                clippedTrims.push(leftTrim);

                if (nrToSpawnY === 1)
                {
                    app.DoorClip(LTPlane,leftTrim,YClip,false);
                    clippedTrims.push(leftTrim);
                }
                else
                {
                    for (let additionalTrims = 0; additionalTrims < nrToSpawnY - 1;++additionalTrims)
                    {
                        let extraTrim = loadedMesh.clone();

                        extraTrim.rotateZ(-Math.PI / 2);

                        extraTrim.position.copy(currentPoints[1]);
                        if (IsX)
                        {
                            if (rightDirection.x < 0)
                            {
                                extraTrim.rotateX(Math.PI);
                            }
                        }
                        else
                        {
                            if (rightDirection.z < 0)
                            {
                                extraTrim.rotateX(-Math.PI / 2);
                            }

                            else
                            {
                                extraTrim.rotateX(Math.PI / 2);
                            }
                        }


                        extraTrim.position.y += dimensions.x / 2;
                        extraTrim.position.y += dimensions.x * (additionalTrims + 1);

                        if (additionalTrims === (nrToSpawnY - 2))
                        {
                            app.DoorClip(LTPlane,extraTrim,YClip,false);
                            clippedTrims.push(extraTrim);
                        }

                        trims.add(extraTrim);
                    }
                }

            //Load right trim

                //Create 3D plane in order to make positioning easier
                const RTPlane = new THREE.Mesh( testPlaneGeom, material );
                const RBPlane = new THREE.Mesh(testPlaneGeom,material);

                RTPlane.position.copy(currentPoints[3]);
                RBPlane.position.copy(currentPoints[2]);
                if (IsX)
                {
                    if (rightDirection.x < 0)
                    {
                        RTPlane.rotateY(Math.PI);
                        RBPlane.rotateY(Math.PI)
                    }

                    RTPlane.rotateZ(Math.PI / 4);
                    RBPlane.rotateZ(-Math.PI / 4);
                }
                else
                {
                    if (rightDirection.z < 0)
                    {
                        RTPlane.rotateY(Math.PI);
                        RBPlane.rotateY(Math.PI)
                    }

                    RTPlane.rotateX(-Math.PI / 4);
                    RBPlane.rotateX(Math.PI / 4);

                }
                usedClippingPlanes.add(RTPlane);
                usedClippingPlanes.add(RBPlane);

                let rightTrim = loadedMesh.clone();
                rightTrim.rotateZ(Math.PI / 2);

                if (IsX)
                {
                    if (rightDirection.x < 0)
                        rightTrim.rotateX(Math.PI);
                }
                else
                {
                    if (rightDirection.z < 0)
                        rightTrim.rotateX(Math.PI / 2);
                    else
                        rightTrim.rotateX(-Math.PI / 2);
                }

                rightTrim.position.copy(currentPoints[2]);
                rightTrim.position.y += dimensions.x / 2;
                trims.add(rightTrim);

            if (!isDoors)
                app.DoorClip(RBPlane,rightTrim,posYClip,false);

            clippedTrims.push(rightTrim);

            if (nrToSpawnY === 1)
            {
                app.DoorClip(RTPlane,rightTrim,YClip,false);
                clippedTrims.push(rightTrim);
            }
            else
            {
                for (let additionalTrims = 0; additionalTrims < nrToSpawnY - 1;++additionalTrims)
                {
                    let extraTrim = loadedMesh.clone();

                    extraTrim.rotateZ(Math.PI / 2);

                    if (IsX)
                    {
                        if (rightDirection.x < 0)
                            extraTrim.rotateX(Math.PI);
                    }
                    else
                    {
                        if (rightDirection.z < 0)
                            extraTrim.rotateX(Math.PI / 2);
                        else
                            extraTrim.rotateX(-Math.PI / 2);
                    }

                    extraTrim.position.copy(currentPoints[2]);
                    extraTrim.position.y += dimensions.x / 2;
                    extraTrim.position.y += dimensions.x * (additionalTrims + 1);

                    if (additionalTrims === (nrToSpawnY - 2))
                    {
                        app.DoorClip(RTPlane,extraTrim,YClip,false);
                        clippedTrims.push(extraTrim);
                    }

                    trims.add(extraTrim);
                }
            }


            //Load top trim
                let topTrim = loadedMesh.clone();
                topTrim.position.copy(currentPoints[0]);
                if (IsX)
                {
                    if (rightDirection.x < 0)
                    {
                        topTrim.position.copy(currentPoints[3]);
                        topTrim.rotateX(Math.PI);
                    }
                    else
                        topTrim.position.y -= dimensions.y;


                    topTrim.position.x += dimensions.x / 2;
                }
                else
                {
                    if (rightDirection.z < 0)
                    {
                        topTrim.position.copy(currentPoints[3]);
                        topTrim.rotateY(Math.PI / 2);
                    }

                    else
                        topTrim.rotateY(-Math.PI/2);
                    topTrim.position.z += dimensions.x / 2;
                    topTrim.position.y -= dimensions.y;
                }

                trims.add(topTrim);
                app.DoorClip(LTPlane,topTrim,posYClip,false)
                clippedTrims.push(topTrim);

                if (nrToSpawnRight === 1)
                {
                    app.DoorClip(RTPlane,topTrim,posYClip,false);
                    clippedTrims.push(topTrim);
                }
                else
                {
                    for (let additionalTrim = 0; additionalTrim < nrToSpawnRight - 1; ++additionalTrim)
                    {
                        let extraTrim = loadedMesh.clone();
                        extraTrim.position.copy(currentPoints[0]);
                        if (IsX)
                        {
                            if (rightDirection.x < 0)
                            {
                                extraTrim.position.copy(currentPoints[3]);
                                extraTrim.rotateX(Math.PI);
                            }
                            else
                                extraTrim.position.y -= dimensions.y;


                            extraTrim.position.x += dimensions.x / 2;
                            extraTrim.position.x += dimensions.x * (additionalTrims + 1);

                        }
                        else
                        {
                            if (rightDirection.z < 0)
                            {
                                extraTrim.position.copy(currentPoints[3]);
                                extraTrim.rotateY(Math.PI / 2);
                            }

                            else
                                extraTrim.rotateY(-Math.PI/2);
                            extraTrim.position.z += dimensions.x / 2;
                            extraTrim.position.z += dimensions.x * (additionalTrims + 1);
                            extraTrim.position.y -= dimensions.y;
                        }

                        if (additionalTrim === nrToSpawnRight - 2)
                        {
                            app.DoorClip(RTPlane,extraTrim,posYClip,false);
                            clippedTrims.push(extraTrim);
                        }

                        trims.add(extraTrim);
                    }
                }



                if (!isDoors)
                {
                    //Load bottom trim
                    let bottomTrim = loadedMesh.clone();
                    bottomTrim.position.copy(currentPoints[1]);

                    if (IsX)
                    {
                        if (rightDirection.x < 0)
                        {
                            bottomTrim.position.copy(currentPoints[2]);
                            bottomTrim.position.y += dimensions.y;
                            bottomTrim.rotateX(Math.PI);
                        }
                        bottomTrim.position.x += dimensions.x / 2;
                    }
                    else
                    {
                        if (rightDirection.z < 0)
                        {
                            bottomTrim.position.copy(currentPoints[2]);
                            bottomTrim.rotateY(Math.PI / 2);
                        }
                        else
                        {
                            bottomTrim.rotateY(-Math.PI/2);
                        }
                        bottomTrim.position.z += dimensions.x / 2;
                    }
                    trims.add(bottomTrim);

                    app.DoorClip(LBPlane,bottomTrim,YClip,false);
                    clippedTrims.push(bottomTrim);

                    if (nrToSpawnRight === 1)
                    {
                        app.DoorClip(RBPlane,bottomTrim,YClip,false);
                        clippedTrims.push(bottomTrim);
                    }
                    else
                    {
                        for (let additionalTrim = 0; additionalTrim < nrToSpawnRight - 1; ++additionalTrim)
                        {
                            //Load bottom trim
                            let extraTrim = loadedMesh.clone();
                            extraTrim.position.copy(currentPoints[1]);

                            if (IsX)
                            {
                                if (rightDirection.x < 0)
                                {
                                    extraTrim.position.copy(currentPoints[2]);
                                    extraTrim.position.y += dimensions.y;
                                    extraTrim.rotateX(Math.PI);
                                }
                                extraTrim.position.x += dimensions.x / 2;
                            }
                            else
                            {
                                if (rightDirection.z < 0)
                                {
                                    extraTrim.position.copy(currentPoints[2]);
                                    extraTrim.rotateY(Math.PI / 2);
                                }
                                else
                                {
                                    extraTrim.rotateY(-Math.PI/2);
                                }
                                extraTrim.position.z += dimensions.x / 2;
                            }
                            if (additionalTrim === nrToSpawnRight - 2)
                            {
                                app.DoorClip(RBPlane,extraTrim,YClip,false);
                                clippedTrims.push(extraTrim);
                            }
                            trims.add(extraTrim);
                        }
                    }

                    UsedClippingPlanesWallFrames.push(usedClippingPlanes);
                    ClippedFrameTrims.push(clippedTrims);
                }
                app.scene.add(trims);
                container.push(trims);
        }

    }

    GenerateWallframeTrims(ID)
    {
        this.ResetWallFrames();
        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let defaultTrim;
            loadedScene.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                    defaultTrim = child.parent;
                }
            });
            app.GenerateSlicedTrims(defaultTrim,WallframePlanes,ConnectedWallframes,false);
        })
    }

    GenerateDoorTrims(ID)
    {
        this.ResetDoorTrims();
        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let defaultTrim;
            loadedScene.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.set(trimColor);
                    defaultTrim = child.parent;
                }
            });
            app.GenerateSlicedTrims(defaultTrim,DoorPlanes,SpawnedDoorTrims,true);
        })
    }

    ReclipFrame(trims, clippingPlanes)
    {
        let NegYClip = new THREE.Vector3(0,-1,0);
        let PosYClip = new THREE.Vector3(0,1,0);

        //In case frame consists of more than 4 trims we need to determine which ones need to get clipped
        if (trims.children.length > 4)
        {
            //Reclip left trim
            this.DoorClip(clippingPlanes.children[1],SelectedClippedFrameTrims[0],PosYClip,false);
            this.DoorClip(clippingPlanes.children[0],SelectedClippedFrameTrims[1],NegYClip,false);

            //Reclip right trim
            this.DoorClip(clippingPlanes.children[3],SelectedClippedFrameTrims[2],PosYClip,false);
            this.DoorClip(clippingPlanes.children[2],SelectedClippedFrameTrims[3],NegYClip,false);

            //Reclip top trim
            this.DoorClip(clippingPlanes.children[0],SelectedClippedFrameTrims[4],PosYClip,false);
            this.DoorClip(clippingPlanes.children[2],SelectedClippedFrameTrims[5],PosYClip,false);

            //Reclip bottom trim
            this.DoorClip(clippingPlanes.children[1],SelectedClippedFrameTrims[6],NegYClip,true);
            this.DoorClip(clippingPlanes.children[3],SelectedClippedFrameTrims[7],NegYClip,true);
        }
        else
        {

            //Reclip left trim
            this.DoorClip(clippingPlanes.children[0],trims.children[0],NegYClip,false);
            this.DoorClip(clippingPlanes.children[1],trims.children[0],PosYClip,false);

            //Reclip right trim
            this.DoorClip(clippingPlanes.children[2],trims.children[1],NegYClip,false);
            this.DoorClip(clippingPlanes.children[3],trims.children[1],PosYClip,false);

            //Reclip top trim
            this.DoorClip(clippingPlanes.children[0],trims.children[2],PosYClip,false);
            this.DoorClip(clippingPlanes.children[2],trims.children[2],PosYClip,false);

            //Reclip bottom trim
            this.DoorClip(clippingPlanes.children[1],trims.children[3],NegYClip,false);
            this.DoorClip(clippingPlanes.children[3],trims.children[3],NegYClip,false);
        }

    }

    FillPlane(ID)
    {
        for (let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
        {
            let currentPoints = WallPlanePoints[currentPlane];

            if (!this.IsInSpecificPlane(this.reticle.position,currentPoints))
                continue;

            let nrToSpawnX;
            let nrToSpawnY;
            let positionOffset = new THREE.Vector3(0,0,0);
            let length;
            let currentPos = new THREE.Vector3(0, 0, 0);
            let clipNormal;
            currentPos.copy(currentPoints[0]);

            //In case ceiling trims are present - make sure decorations spawn below ceiling trim
            if (SpawnedCeilingTrims.length !== 0)
            {
                let trimBox = new THREE.Box3().setFromObject(SpawnedCeilingTrims[0]);
                let trimdimensions = new THREE.Vector3(0, 0, 0);
                trimBox.getSize(trimdimensions);
                currentPos.y -= trimdimensions.y;
            }

            //Check direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
            let absDirection = new THREE.Vector3(0, 0, 0);
            absDirection.copy(direction);
            absDirection.x = Math.abs(absDirection.x);
            absDirection.y = Math.abs(absDirection.y);
            absDirection.z = Math.abs(absDirection.z);
            let IsX = absDirection.x > absDirection.z;

            //Calculate distance from top to bottom
            let Up = new THREE.Vector3(0,0,0);
            Up.copy(currentPoints[1]);
            Up.sub(currentPoints[0]);

            let YDistance = Math.abs(Up.y);

            if (SpawnedFloorTrims.length !== 0)
            {
                let trimBox = new THREE.Box3().setFromObject(SpawnedCeilingTrims[0]);
                let trimdimensions = new THREE.Vector3(0, 0, 0);
                trimBox.getSize(trimdimensions);

                YDistance -= trimdimensions.y;
            }

            window.gltfLoader.load(ID + ".gltf", function (gltf)
            {
                let loadedScene = gltf.scene;
                let trimToSpawn;
                loadedScene.traverse((child) =>
                {
                    if (child.isMesh)
                    {
                        child.material.color = decorationColor;
                        trimToSpawn = child.parent;
                    }
                });
                let box = new THREE.Box3().setFromObject(trimToSpawn);
                let dimensions = new THREE.Vector3(0, 0, 0);
                box.getSize(dimensions);
                currentPos.y -= dimensions.y / 2;
                trimToSpawn.position.copy(currentPos);

                nrToSpawnY = Math.floor(YDistance / dimensions.y);
                if (IsX)
                {
                    nrToSpawnX = Math.floor(absDirection.x / dimensions.x);
                    length = absDirection.x;
                    if (direction.x < 0)
                    {
                        trimToSpawn.rotateY(Math.PI);
                        positionOffset.x = -dimensions.x;
                        clipNormal = new THREE.Vector3(1,0,0);
                    }
                    else
                    {
                        positionOffset.x = dimensions.x;
                        clipNormal = new THREE.Vector3(-1,0,0);
                    }

                }
                else
                {
                    nrToSpawnX = Math.floor(absDirection.z / dimensions.x);
                    length = absDirection.z;
                    if (direction.z < 0) {
                        trimToSpawn.rotateY(Math.PI / 2)
                        positionOffset.z = -dimensions.x;
                    }
                    if (direction.z > 0) {
                        trimToSpawn.rotateY(-Math.PI / 2)
                        positionOffset.z = dimensions.x;
                    }
                }

                SpawnedDecorations.push(trimToSpawn)

                //Decrement nr by one seeing as we already spawned one to get the data
                if (nrToSpawnX > 0)
                --nrToSpawnX;

                if (IsX)
                {
                    if (direction.x < 0)
                    {
                        trimToSpawn.position.x -= dimensions.x;
                    }
                }
                else if (direction.z < 0)
                    trimToSpawn.position.z -= dimensions.x;

                if (IsX)
                    trimToSpawn.position.x += dimensions.x / 2;
                else
                    trimToSpawn.position.z += dimensions.x / 2;

                app.scene.add(trimToSpawn);

                //Now we load enough meshes to fill up top line of plane

                for(let currY = 0; currY < nrToSpawnY; ++currY)
                {
                    for(let currX = 0; currX <= nrToSpawnX; ++currX)
                    {
                            let trimToSpawn2 = trimToSpawn.clone();
                            trimToSpawn2.position.copy(currentPos);
                            if (currY === 0 && currX === 0 )
                            {
                                if (nrToSpawnX === 0)
                                    continue;
                                ++currX;
                            }
                            trimToSpawn2.position.addScaledVector(positionOffset,currX);
                            trimToSpawn2.position.y -= dimensions.y * currY;
                            if (IsX)
                            {
                                if (direction.x < 0)
                                {
                                    trimToSpawn2.position.x -= dimensions.x / 2;
                                }
                                else
                                {
                                    trimToSpawn2.position.x += dimensions.x / 2;
                                }

                            }
                            else
                            {
                                if (direction.z < 0)
                                {
                                    trimToSpawn2.position.z -= dimensions.x / 2;
                                }
                                if (direction.z > 0)
                                {
                                    trimToSpawn2.position.z += dimensions.x / 2;
                                }
                            }

                            SpawnedDecorations.push(trimToSpawn2);
                            app.scene.add(trimToSpawn2);
                    }
                }
            })
        }
    }

    GenerateCeilingTrims(ID)
    {
        this.ResetCeilingTrims();
        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let trimToSpawn;
            if (decoType !== DecorationTypes.UplightTrim) {
                loadedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                        trimToSpawn = child.parent;
                    }
                });
            } else
                trimToSpawn = loadedScene;

            for(let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
            {
                let currentPoints = WallPlanePoints[currentPlane];

                //Check direction of plane
                let direction = app.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
                let absDirection = new THREE.Vector3(0,0,0);
                absDirection.copy(direction);
                absDirection.x = Math.abs(absDirection.x);
                absDirection.y = Math.abs(absDirection.y);
                absDirection.z = Math.abs(absDirection.z);
                let IsX = absDirection.x > absDirection.z;

                let startPosition = currentPoints[0];
                if (IsX)
                {
                    if (direction.x < 0)
                        startPosition = currentPoints[3];
                }
                else
                {
                    if (direction.z < 0)
                        startPosition = currentPoints[3];
                }

                app.GenerateTrims(trimToSpawn,startPosition, direction, absDirection, IsX, DecorationTypes.CeilingTrim);
            }
        })

    }

    GenerateFloorTrims(ID)
    {
        this.ResetFloorTrims();

        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let trimToSpawn;
            if (decoType !== DecorationTypes.UplightTrim) {
                loadedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                        trimToSpawn = child.parent;
                    }
                });
            } else
                trimToSpawn = loadedScene;

            for(let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
            {
                let currentPoints = WallPlanePoints[currentPlane];

                //Check direction of plane
                let direction = app.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);
                let absDirection = new THREE.Vector3(0,0,0);
                absDirection.copy(direction);
                absDirection.x = Math.abs(absDirection.x);
                absDirection.y = Math.abs(absDirection.y);
                absDirection.z = Math.abs(absDirection.z);
                let IsX = absDirection.x > absDirection.z;

                let startPosition = currentPoints[1];
                if (IsX)
                {
                    if (direction.x < 0)
                        startPosition = currentPoints[2];
                }
                else
                {
                    if (direction.z < 0)
                        startPosition = currentPoints[2];
                }

                app.GenerateTrims(trimToSpawn, startPosition, direction, absDirection, IsX, DecorationTypes.FloorTrim);
            }
        })


    }

    GenerateWallTrims(ID)
    {
        //this.ResetWallTrims();

        window.gltfLoader.load(ID + ".gltf", function (gltf) {
            let loadedScene = gltf.scene;
            let trimToSpawn;
            if (decoType !== DecorationTypes.UplightTrim) {
                loadedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(trimColor);
                        trimToSpawn = child.parent;
                    }
                });
            } else
                trimToSpawn = loadedScene;


            for(let currentPlane = 0; currentPlane < WallPlanePoints.length; ++currentPlane)
            {
                let currentPoints = WallPlanePoints[currentPlane];

                //Check direction of plane
                let direction = app.CalculatePlaneDirection(currentPoints[1], currentPoints[2]);
                let absDirection = new THREE.Vector3(0,0,0);
                absDirection.copy(direction);
                absDirection.x = Math.abs(absDirection.x);
                absDirection.y = Math.abs(absDirection.y);
                absDirection.z = Math.abs(absDirection.z);
                let IsX = absDirection.x > absDirection.z;
                let startPosition = currentPoints[1];
                if (IsX)
                {
                    if (direction.x < 0)
                        startPosition = currentPoints[2];
                }
                else
                {
                    if (direction.z < 0)
                        startPosition = currentPoints[2];
                }


                let startPoint = new THREE.Vector3(0,0,0);

                startPoint.copy(startPosition);
                startPoint.y = app.reticle.position.y;

                app.GenerateTrims(trimToSpawn, startPoint, direction, absDirection, IsX, DecorationTypes.WallTrim);
            }

            ConnectedWallTrims.push([...SpawnedWallTrims]);
            SpawnedWallTrims.length = 0;
        })
    }

    IsInPlane(position)
    {
        var inside = false;
        for(var currentPlaneId = 0; currentPlaneId < WallPlanePoints.length;++currentPlaneId)
        {
             inside = this.IsInSpecificPlane(position,WallPlanePoints[currentPlaneId]);
             if (inside)
                 return inside;
        }

        return inside;
    }

    IsInSpecificPlane(position,planePoints)
    {
        var inside = false;
            var highest = new THREE.Vector3(0,0,0);
            var lowest = new THREE.Vector3(0,0,0);
            var currentPoints = planePoints;
            highest.copy(currentPoints[0]);
            lowest.copy(currentPoints[0]);
            for(var i = 0; i < currentPoints.length; ++i)
            {
                //Calculate boundaries
                if (highest.x < currentPoints[i].x)
                    highest.x = currentPoints[i].x;

                if (highest.y < currentPoints[i].y)
                    highest.y = currentPoints[i].y;

                if (highest.z < currentPoints[i].z)
                    highest.z = currentPoints[i].z;

                if (lowest.x > currentPoints[i].x)
                    lowest.x = currentPoints[i].x;

                if (lowest.y > currentPoints[i].y)
                    lowest.y = currentPoints[i].y;

                if (lowest.z > currentPoints[i].z)
                    lowest.z = currentPoints[i].z;
            }

            //Calculate Right direction of plane
            let direction = this.CalculatePlaneDirection(currentPoints[1],currentPoints[2]);

            //Check if given position is within boundary
            if (IsDirectionX)
            {
                if (position.x <= highest.x && position.x >= lowest.x
                    &&position.y <= highest.y  && position.y >= lowest.y)
                {
                    let distanceToMarker = Math.abs(currentPoints[0].z - position.z);
                    if (distanceToMarker < 0.25)
                    {
                        inside = true;
                        HitPlaneDirection = direction;
                    }
                }
            }
            else
            {
                if (position.z <= highest.z && position.z >= lowest.z
                    && position.y <= highest.y && position.y >= lowest.y)
                {
                    let distanceToMarker = Math.abs(currentPoints[0].x - position.x);
                    if (distanceToMarker < 0.25)
                    {
                        inside = true;
                        HitPlaneDirection = direction;
                    }
                }
            }

        return inside;
    }

    CalculatePlaneDirection(startPos, endPos)
    {
        let direction = new THREE.Vector3(0,0,0);
        direction.copy(endPos);
        direction.sub(startPos);

        let absDirection = new THREE.Vector3(0,0,0);
        absDirection.copy(direction);
        absDirection.x = Math.abs(absDirection.x);
        absDirection.y = Math.abs(absDirection.y);
        absDirection.z = Math.abs(absDirection.z);
        IsDirectionX = absDirection.x > absDirection.z;

        return direction;
    }

    CreateButton(text, left)
    {
        const button = document.createElement('button');

        button.style.display = '';

        button.style.cursor = 'pointer';
        button.style.left = left;
        button.style.width = '100px';
        button.textContent = text;
        this.stylizeElement(button);

        button.onmouseenter = function () {

            button.style.opacity = '1.0';

        };

        button.onmouseleave = function () {

            button.style.opacity = '0.5';

        };

        return button;
    }

    CreateDoneButton()
    {
        let left = 'calc(15% - 50px)';
        let text = 'Done';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.DoneClicked();
        }

        document.body.appendChild(button);
        DoneButton = button;
    }

    CreateSelectWallframesButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Select wallframes';
        const button = this.CreateButton(text,left)

        button.onclick = function ()
        {
            app.SelectWallframesClicked();
        }

        document.body.appendChild(button);
        WallframesButton = button;
    }

    CreateSelectDoorsButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Select Doors';
       DoorsButton = this.CreateButton(text,left)

        DoorsButton.onclick = function ()
        {
            app.SelectDoorsClicked();
        }

        document.body.appendChild(DoorsButton);
    }

    CreatePlaceButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Place';
        PlaceButton = this.CreateButton(text,left);

        PlaceButton.onclick = function ()
        {
            app.PlaceClicked();
        }

        document.body.appendChild(PlaceButton);
    }

    CreateEditButton()
    {
        let left = 'calc(20% - 50px)';
        let text = 'Edit';
        EditButton = this.CreateButton(text,left);

        EditButton.onclick = function ()
        {
            app.EditClicked();
        }

        document.body.appendChild(EditButton);
    }

    CreateSelectButton()
    {
        let left = 'calc(50% - 50px)';
        let text = 'Select';
        SelectButton = this.CreateButton(text,left);

        SelectButton.onclick = function ()
        {
            app.SelectClicked();
        }

        document.body.appendChild(SelectButton);
    }

    CreateRemoveAllButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Remove All';
        RemoveAllButton = this.CreateButton(text,left)
        RemoveAllButton.style.bottom = 'calc(20%)';

        RemoveAllButton.onclick = function ()
        {
            app.RemoveAllClicked();
        }

        document.body.appendChild(RemoveAllButton);
    }

    //Removes only the selected element
    CreateRemoveButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Remove Selected';
        RemoveButton = this.CreateButton(text, left);

        RemoveButton.onclick = function ()
        {
            app.RemoveSelectedClicked();
        }

        document.body.appendChild(RemoveButton);
    }

    CreateRestartButton()
    {
        let left = 'calc(85% - 50px)';
        let text = 'Restart';
        RestartButton = this.CreateButton(text,left)

        RestartButton.onclick = function ()
        {
            window.location.reload();
            return false;
        }

        document.body.appendChild(RestartButton);

    }

    stylizeElement( element )
    {

        element.style.position = 'absolute';
        element.style.bottom = '60px';
        element.style.padding = '12px 6px';
        element.style.border = '1px solid #fff';
        element.style.borderRadius = '4px';
        element.style.background = 'rgba(0,0,0,0.1)';
        element.style.color = '#fff';
        element.style.font = 'normal 13px sans-serif';
        element.style.textAlign = 'center';
        element.style.opacity = '0.5';
        element.style.outline = 'none';
        element.style.zIndex = '999';
    }

    EditClicked()
    {
        inEditMode = !inEditMode;
        if (inEditMode)
        {
            ModelID = null;
            PlaceButton.style.display = "none";
            RestartButton.style.display = "none";
            document.getElementById("OpenButton").style.display = "none";
            SelectButton.style.display = "block";
            RemoveAllButton.style.display = "block";
            RemoveButton.style.display = "block";
            EditButton.textContent = 'Add';
            defaultGui.hide();
            transformGui.show();
            if (SpawnedWallTrims.length > 0)
            {
                paramsWallTrimHeight.height = SpawnedWallTrims[0].position.y;
            }
            app.scene.remove(app.reticle);
            app.reticle = new Reticle();
            app.scene.add(app.reticle);
        }
        else
        {
            EditButton.textContent = 'Edit';
            PlaceButton.style.display = "block";
            RestartButton.style.display = "block";
            document.getElementById("OpenButton").style.display = "block";
            SelectButton.style.display = "none";
            RemoveAllButton.style.display = "none";
            RemoveButton.style.display = 'none';
            defaultGui.show();
            transformGui.hide();
            if (WidthController)
            {
                transformGui.remove(WidthController);
                WidthController = null;
            }
            if (DecoToMove)
            {
                DecoToMove = null;
                IsMovingDeco = false;
            }
            app.UpdateTrimColor();
        }
    }

    SelectClicked()
    {
        if (WidthController)
        {
            transformGui.remove(WidthController);
            WidthController = null;
        }
        if (DecoToMove)
        {
            DecoToMove = null;
            IsMovingDeco = false;
            return;
        }
        selectedFrame = false;
        this.UpdateTrimColor();

        //Check walltrims
        if (ConnectedWallTrims)
        {
            TrimsToMove = null;
            for (let i = 0; i < ConnectedWallTrims.length; ++i)
            {
                let currentTrims = ConnectedWallTrims[i];
                for (let j = 0; j < currentTrims.length; ++j)
                {
                    let distanceToMarker = currentTrims[j].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < 0.5)
                    {
                        TrimsToMove = currentTrims;
                        paramsWallTrimHeight.height = currentTrims[j].position.y;
                        this.RecolorSelectedTrims();
                        return;
                    }
                }
            }
        }

        //Check wallframes
        if (ConnectedWallframes.length > 0)
        {
            let currentShortestDistance = 0.5;
            for (let i = 0; i < ConnectedWallframes.length; ++i)
            {
                let currentFrame = ConnectedWallframes[i]

                for (let j = 0; j < currentFrame.children.length; ++j)
                {
                    let distanceToMarker = currentFrame.children[j].position.distanceTo(this.reticle.position);
                    if (distanceToMarker < 0.5)
                    {
                        if (distanceToMarker < currentShortestDistance)
                        {
                            currentShortestDistance = distanceToMarker;
                            FrameToMove = currentFrame;
                            FtMClippingPlanes = UsedClippingPlanesWallFrames[i];
                            SelectedClippedFrameTrims = ClippedFrameTrims[i];
                            selectedFrame = true;
                        }
                    }
                }
            }

            for (let currPlane = 0; currPlane < WallPlanePoints.length; ++currPlane)
            {
                let currentPlanePoints = WallPlanePoints[currPlane];
                if (this.IsInSpecificPlane(FrameToMove.children[0].position,currentPlanePoints))
                {
                    this.RecolorSelectedFrame();

                    //Force recalculation of IsDirection to prevent bugs
                    let direction = this.CalculatePlaneDirection(FrameToMove.children[0].position,FrameToMove.children[3].position)
                    let absDirection = new THREE.Vector3(Math.abs(direction.x),Math.abs(direction.y),Math.abs(direction.z))
                    IsMoveDirectionX = absDirection.x > absDirection.z;
                    if (IsMoveDirectionX)
                        WidthController = transformGui.add(paramsWallFrameWidth,'width',currentPlanePoints[0].x, currentPlanePoints[3].x).onChange(this.MoveWallFrameWidth);
                    else
                        WidthController = transformGui.add(paramsWallFrameWidth,'width',currentPlanePoints[0].z, -currentPlanePoints[3].z).onChange(this.MoveWallFrameWidth);
                    return;
                }

            }
        }

        //Check decorations
        {
            if (SpawnedDecorations)
            {
                let currentShortestDistance = 0.15;
                for (let currDeco = 0; currDeco < SpawnedDecorations.length; ++currDeco)
                {
                    let distanceToMarker = SpawnedDecorations[currDeco].position.distanceToSquared(this.reticle.position);
                    if (distanceToMarker < 0.15)
                    {
                        if (distanceToMarker < currentShortestDistance)
                        {
                            DecoToMove = SpawnedDecorations[currDeco];
                            IsMovingDeco = true;
                        }
                    }
                }
            }
        }
    }

    RecolorSelectedFrame()
    {
        for (let i = 0; i < FrameToMove.children.length; ++i)
        {
            FrameToMove.children[i].children[0].material.color.setHex(0x00FF00);
        }
    }

    RecolorSelectedTrims()
    {
        for (let i = 0; i < TrimsToMove.length; ++i)
        {
            TrimsToMove[i].children[0].material.color.setHex(0x00FF00);
        }
    }

    PlaceClicked()
    {
        if (FinishedPlacingWalls)
        {
            if (ModelID != null)
                this.LoadModel(this.reticle.position, this.scene);
        }
    }

    RemoveAllClicked()
    {
        this.ResetDecorations();
        this.ResetWallTrims();
        this.ResetWallFrames();
        this.ResetCeilingTrims();
        this.ResetFloorTrims();
        this.ResetDoorTrims();
    }

    RemoveSelectedClicked()
    {
        //1.Check what is selected
        //2.Remove selected element from appropriate container and scene

        if (selectedFrame)
        {
           this.scene.remove(FrameToMove);
           const frameIndex = ConnectedWallframes.indexOf(FrameToMove);
           if (frameIndex > -1)
           {
               ConnectedWallframes.splice(frameIndex,1);
           }

           //In this case, we also need to make sure we remove related clipping planes from container
            const clippingIndex = UsedClippingPlanesWallFrames.indexOf(FtMClippingPlanes);
           if (clippingIndex > -1)
           {
               UsedClippingPlanesWallFrames.splice(clippingIndex,1);
           }
           FrameToMove = null;
           FtMClippingPlanes = null;
           selectedFrame = false;
        }

        if (TrimsToMove)
        {
            for (let currentTrim = 0; currentTrim < TrimsToMove.length; ++currentTrim)
            {
                this.scene.remove(TrimsToMove[currentTrim]);
            }

            const index = ConnectedWallTrims.indexOf(TrimsToMove);
            if (index > -1)
            {
                ConnectedWallTrims.splice(index,1);
            }
            TrimsToMove = null;
        }

        if (IsMovingDeco)
        {
            this.scene.remove(DecoToMove);
            const index = SpawnedDecorations.indexOf(DecoToMove);
            if (index > -1)
            {
                SpawnedDecorations.splice(index,1);
            }
            IsMovingDeco = false;
            DecoToMove = null;
        }
    }

    DoneClicked()
    {
        document.getElementById("OpenButton").style.display = "block";
        this.CreatePlaceButton();
        this.CreateRestartButton();
        this.CreateRemoveAllButton();
        this.CreateRemoveButton();
        this.CreateEditButton();
        this.CreateSelectButton();
        DoneButton.style.display = "none"
        WallframesButton.style.display = 'none';
        SelectButton.style.display = "none";
        RemoveAllButton.style.display = "none";
        RemoveButton.style.display = "none";
        DoorsButton.style.display = "none";
        PlacingPointsWallframes = false;
        PlacingPointsDoors = false;
        this.ResetWallframePoints();

        //Set up colorPicker
        defaultGui = new dat.GUI();
        transformGui = new dat.GUI();
        transformGui.hide();

        //Manually call update so color variable gets properly initalized with the default value of the picker
        this.UpdateTrimColor();
        this.UpdateDecorationColor();
        this.UpdateWallColor();

        //Set a callback so that whenever user changes a value, it calls the update
        defaultGui.addColor(paramsTrimColor, 'trimColor').onChange(this.UpdateTrimColor);
        defaultGui.addColor(paramsDecorationColor, 'decorationColor').onChange(this.UpdateDecorationColor);
        defaultGui.addColor(paramsWallColor, 'wallColor').onChange(this.UpdateWallColor);
        defaultGui.add(paramsFillPlanes,'fillPlanes').onChange(this.UpdatePlaneFill);
        defaultGui.add(paramsVisibility, 'showGuides').onChange(this.UpdateGuideVisibility);
        defaultGui.add(estimatedWallMeters, 'wallMeters');
        defaultGui.add(estimatedFrameMeters, 'frameMeters');

        transformGui.add(paramsWallTrimHeight,'height',ConstrainedYPosWalls - WallHeight,ConstrainedYPosWalls).onChange(this.MoveWallTrimsHeight);
    }

    SelectWallframesClicked()
    {
        PlacingPointsWallframes = true;
        PlacingPointsDoors = false;
        WallframesButton.style.display = 'none';
    }

    SelectDoorsClicked()
    {
        PlacingPointsDoors = true;
        PlacingPointsWallframes = false;
        DoorsButton.style.display = 'none';
    }
}

window.app = new App();