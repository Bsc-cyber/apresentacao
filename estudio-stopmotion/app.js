const dom = {
    projectName: document.getElementById('project-name'),
    projectDescription: document.getElementById('project-description'),
    projectList: document.getElementById('project-list'),
    layerList: document.getElementById('layer-list'),
    assetGrid: document.getElementById('asset-grid'),
    timelineTrack: document.getElementById('timeline-track'),
    inputBg: document.getElementById('input-bg'),
    inputActor: document.getElementById('input-actor'),
    inputObject: document.getElementById('input-object'),
    inputProject: document.getElementById('input-project'),
    btnNewProject: document.getElementById('btn-new-project'),
    btnImportBackground: document.getElementById('btn-import-background'),
    btnImportActor: document.getElementById('btn-import-actor'),
    btnImportObject: document.getElementById('btn-import-object'),
    btnImportProject: document.getElementById('btn-import-project'),
    btnExport: document.getElementById('btn-export'),
    btnRender: document.getElementById('btn-render'),
    btnConfig: document.getElementById('btn-config'),
    btnAddFrame: document.getElementById('btn-add-frame'),
    btnExportFrame: document.getElementById('btn-export-frame'),
    btnCreateRig: document.getElementById('btn-create-rig'),
    btnLockToggle: document.getElementById('btn-lock-toggle'),
    onionPanel: document.getElementById('onion-panel'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    onionEnabled: document.getElementById('onion-enabled'),
    onionPrev: document.getElementById('onion-prev'),
    onionNext: document.getElementById('onion-next'),
    onionOpacityRange: document.getElementById('onion-opacity-range'),
    onionPrevCount: document.getElementById('onion-prev-count'),
    onionNextCount: document.getElementById('onion-next-count'),
    onionOpacity: document.getElementById('onion-opacity'),
    infoFrameCount: document.getElementById('info-frame-count'),
    infoTimecode: document.getElementById('info-timecode'),
    infoMode: document.getElementById('info-mode'),
    tabNav: document.getElementById('tab-nav'),
    searchInput: document.getElementById('search-input'),
};

const appState = {
    db: null,
    projects: [],
    project: null,
    selectedObjectId: null,
    activeTab: 'cenarios',
    activeTool: 'move',
    onion: {
        enabled: true,
        previous: 2,
        next: 2,
        opacity: 0.35,
    },
};

const scene = {
    app: null,
    background: null,
    layers: {
        ghost: null,
        background: null,
        objects: null,
        rig: null,
    },
};

function initStudio() {
    initPixi();
    initDatabase();
    bindUI();
    loadProjects();
    updateToolbar();
}

function initPixi() {
    const container = document.getElementById('pixi-root');
    const app = new PIXI.Application({
        backgroundColor: 0x101026,
        antialias: true,
        resizeTo: container,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });

    container.appendChild(app.view);
    app.stage.sortableChildren = true;

    const ghostLayer = new PIXI.Container();
    const backgroundLayer = new PIXI.Container();
    const objectLayer = new PIXI.Container();
    const rigLayer = new PIXI.Container();

    ghostLayer.zIndex = 0;
    backgroundLayer.zIndex = 1;
    objectLayer.zIndex = 2;
    rigLayer.zIndex = 3;

    app.stage.addChild(ghostLayer, backgroundLayer, objectLayer, rigLayer);

    scene.app = app;
    scene.layers.ghost = ghostLayer;
    scene.layers.background = backgroundLayer;
    scene.layers.objects = objectLayer;
    scene.layers.rig = rigLayer;

    window.addEventListener('resize', () => {
        if (scene.background) {
            fitBackground(scene.background);
        }
    });
}

function initDatabase() {
    const db = new Dexie('StopMotionStudioDB');
    db.version(1).stores({ projects: '++id,name,updated' });
    appState.db = db;
}

async function loadProjects() {
    const projects = await appState.db.projects.toArray();
    appState.projects = projects.sort((a, b) => b.updated.localeCompare(a.updated));
    renderProjectList();

    if (appState.projects.length) {
        loadProject(appState.projects[0].id);
    } else {
        createProject('Aventura na Floresta');
    }
}

function createProject(defaultName) {
    const name = prompt('Nome do novo projeto', defaultName) || defaultName;
    const project = {
        id: Date.now(),
        name,
        description: 'Projeto Stop Motion salvo localmente.',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        assets: { cenarios: [], personagens: [], objetos: [], filtros: [] },
        objects: [],
        layers: [],
        frames: [],
        settings: { resolution: '1920x1080', fps: 24, duration: 0.04, previewMode: 'Padrão' },
        selected: { objectId: null },
    };

    appState.projects.unshift(project);
    appState.project = project;
    saveProject(project);
    loadProject(project.id);
    renderProjectList();
}

function saveProject(project) {
    project.updated = new Date().toISOString();
    appState.db.projects.put(project);
    const index = appState.projects.findIndex((item) => item.id === project.id);
    if (index >= 0) {
        appState.projects[index] = project;
    } else {
        appState.projects.unshift(project);
    }
    renderProjectList();
}

function loadProject(id) {
    const project = appState.projects.find((item) => item.id === id);
    if (!project) return;
    appState.project = project;
    appState.selectedObjectId = project.selected.objectId || null;
    clearScene();
    if (project.settings.backgroundUrl) {
        setBackground(project.settings.backgroundUrl, false);
    }
    project.objects.forEach((objectState) => restoreSceneObject(objectState));
    renderProjectList();
    renderLayers();
    renderAssetLibrary();
    renderTimeline();
    updateToolbar();
}

function clearScene() {
    scene.layers.ghost.removeChildren();
    scene.layers.background.removeChildren();
    scene.layers.objects.removeChildren();
    scene.layers.rig.removeChildren();
    scene.background = null;
}

function bindUI() {
    dom.btnNewProject.addEventListener('click', () => createProject('Meu Primeiro Filme'));
    dom.btnImportBackground.addEventListener('click', () => dom.inputBg.click());
    dom.btnImportActor.addEventListener('click', () => dom.inputActor.click());
    dom.btnImportObject.addEventListener('click', () => dom.inputObject.click());
    dom.btnImportProject.addEventListener('click', () => dom.inputProject.click());
    dom.btnExport.addEventListener('click', exportProject);
    dom.btnRender.addEventListener('click', exportVideo);
    dom.btnAddFrame.addEventListener('click', captureFrame);
    dom.btnExportFrame.addEventListener('click', captureFrame);
    dom.btnCreateRig.addEventListener('click', createRigForSelected);
    dom.btnLockToggle.addEventListener('click', toggleSelectedLock);
    dom.btnClearSelection.addEventListener('click', () => selectObject(null));

    dom.inputBg.addEventListener('change', (event) => onFilesSelected(event, 'cenarios'));
    dom.inputActor.addEventListener('change', (event) => onFilesSelected(event, 'personagens'));
    dom.inputObject.addEventListener('change', (event) => onFilesSelected(event, 'objetos'));
    dom.inputProject.addEventListener('change', importProjectFile);
    initOnionDrag();

    dom.onionEnabled.addEventListener('change', () => {
        appState.onion.enabled = dom.onionEnabled.checked;
        renderOnionSkin();
    });

    dom.onionPrev.addEventListener('input', () => {
        appState.onion.previous = Number(dom.onionPrev.value);
        dom.onionPrevCount.textContent = dom.onionPrev.value;
        renderOnionSkin();
    });

    dom.onionNext.addEventListener('input', () => {
        appState.onion.next = Number(dom.onionNext.value);
        dom.onionNextCount.textContent = dom.onionNext.value;
        renderOnionSkin();
    });

    dom.onionOpacityRange.addEventListener('input', () => {
        appState.onion.opacity = Number(dom.onionOpacityRange.value) / 100;
        dom.onionOpacity.textContent = `${dom.onionOpacityRange.value}%`;
        renderOnionSkin();
    });

    dom.tabNav.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        dom.tabNav.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        appState.activeTab = button.dataset.tab;
        renderAssetLibrary();
    });

    dom.searchInput.addEventListener('input', renderAssetLibrary);

    document.getElementById('tool-move').addEventListener('click', () => setActiveTool('move'));
    document.getElementById('tool-rotate').addEventListener('click', () => setActiveTool('rotate'));
    document.getElementById('tool-scale').addEventListener('click', () => setActiveTool('scale'));
    document.getElementById('tool-duplicate').addEventListener('click', duplicateSelectedObject);
    document.getElementById('tool-lock').addEventListener('click', toggleSelectedLock);
    document.getElementById('tool-delete').addEventListener('click', deleteSelectedObject);
}

function initOnionDrag() {
    const panel = dom.onionPanel;
    if (!panel) return;

    const dragState = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
    };

    panel.addEventListener('pointerdown', (event) => {
        if (event.target.closest('input') || event.target.closest('button') || event.target.closest('label')) return;
        event.preventDefault();
        panel.setPointerCapture(event.pointerId);
        const rect = panel.getBoundingClientRect();
        const parentRect = panel.offsetParent.getBoundingClientRect();
        dragState.active = true;
        dragState.pointerId = event.pointerId;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        dragState.startLeft = rect.left - parentRect.left;
        dragState.startTop = rect.top - parentRect.top;
        panel.style.left = `${dragState.startLeft}px`;
        panel.style.top = `${dragState.startTop}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.cursor = 'grabbing';
    });

    panel.addEventListener('pointermove', (event) => {
        if (!dragState.active || event.pointerId !== dragState.pointerId) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        panel.style.left = `${dragState.startLeft + dx}px`;
        panel.style.top = `${dragState.startTop + dy}px`;
    });

    panel.addEventListener('pointerup', (event) => {
        if (!dragState.active || event.pointerId !== dragState.pointerId) return;
        dragState.active = false;
        panel.releasePointerCapture(event.pointerId);
        panel.style.cursor = 'grab';
    });
}

function setActiveTool(tool) {
    appState.activeTool = tool;
    dom.infoMode.textContent = `Modo: ${tool.charAt(0).toUpperCase() + tool.slice(1)}`;
}

function onFilesSelected(event, category) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
        const src = reader.result;
        const asset = createAsset(file.name, src, category);
        appState.project.assets[category].unshift(asset);
        saveProject(appState.project);
        renderAssetLibrary();
        if (category === 'cenarios') {
            setBackground(src);
        }
    };
    reader.readAsDataURL(file);
}

function createAsset(name, src, category) {
    return {
        id: `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        src,
        created: new Date().toISOString(),
        category,
    };
}

function renderProjectList() {
    dom.projectList.innerHTML = '';
    appState.projects.forEach((project) => {
        const card = document.createElement('div');
        card.className = 'project-card' + (appState.project?.id === project.id ? ' active' : '');
        card.innerHTML = `
            <div class="project-thumb"></div>
            <div class="project-info">
                <div class="project-title">${project.name}</div>
                <div class="project-meta">Editado há pouco</div>
            </div>
        `;
        card.addEventListener('click', () => loadProject(project.id));
        dom.projectList.appendChild(card);
    });
}

function renderAssetLibrary() {
    const query = dom.searchInput.value.toLowerCase();
    const assets = appState.project?.assets[appState.activeTab] || [];
    dom.assetGrid.innerHTML = '';

    assets
        .filter((asset) => asset.name.toLowerCase().includes(query))
        .forEach((asset) => {
            const card = document.createElement('div');
            card.className = 'asset-card';
            card.innerHTML = `
                <div class="asset-thumb"><img src="${asset.src}" alt="${asset.name}"></div>
                <div class="asset-info">
                    <div class="asset-title">${asset.name}</div>
                    <div class="asset-meta">${asset.category}</div>
                </div>
            `;
            card.addEventListener('click', () => selectAsset(asset));
            dom.assetGrid.appendChild(card);
        });

    if (!dom.assetGrid.childElementCount) {
        dom.assetGrid.innerHTML = `<div class="asset-card" style="grid-column: span 2;
            justify-content: center; text-align: center; color: var(--muted);">Nenhum ativo encontrado nessa categoria.</div>`;
    }
}

function selectAsset(asset) {
    if (!asset || !appState.project) return;
    if (asset.category === 'cenarios') {
        setBackground(asset.src);
        return;
    }

    if (asset.category === 'personagens') {
        addSceneObject(asset, 'personagem');
        return;
    }

    if (asset.category === 'objetos') {
        addSceneObject(asset, 'objeto');
        return;
    }
}

function setBackground(src, save = true) {
    if (scene.background) {
        scene.layers.background.removeChild(scene.background);
        scene.background.destroy();
    }

    const texture = PIXI.Texture.from(src);
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.interactive = true;
    sprite.on('pointerdown', () => selectObject(null));

    fitBackground(sprite);
    scene.layers.background.addChild(sprite);
    scene.background = sprite;
    appState.project.settings.backgroundUrl = src;
    if (save) saveProject(appState.project);
}

function fitBackground(sprite) {
    const screenWidth = scene.app.screen.width;
    const screenHeight = scene.app.screen.height;
    const textureWidth = sprite.texture.width;
    const textureHeight = sprite.texture.height;

    const scale = Math.min(screenWidth / textureWidth, screenHeight / textureHeight);
    sprite.scale.set(scale);
    sprite.x = screenWidth / 2;
    sprite.y = screenHeight / 2;
}

function addSceneObject(asset, type) {
    const sprite = new PIXI.Sprite.from(asset.src);
    sprite.anchor.set(0.5, 0.5);
    sprite.x = scene.app.screen.width * 0.52;
    sprite.y = scene.app.screen.height * 0.56;
    sprite.scale.set(0.65);
    sprite.interactive = true;
    sprite.buttonMode = true;
    sprite.cursor = 'grab';
    sprite.objectId = `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sprite.assetId = asset.id;
    sprite.objectType = type;
    sprite.locked = false;
    sprite.zIndex = scene.layers.objects.children.length + 100;
    sprite.on('pointerdown', onObjectPointerDown);
    sprite.on('pointerup', onObjectPointerUp);
    sprite.on('pointerupoutside', onObjectPointerUp);
    sprite.on('pointermove', onObjectPointerMove);

    scene.layers.objects.addChild(sprite);

    const objectState = {
        id: sprite.objectId,
        assetId: asset.id,
        type,
        x: sprite.x,
        y: sprite.y,
        scale: sprite.scale.x,
        rotation: sprite.rotation,
        alpha: sprite.alpha,
        visible: true,
        locked: false,
        zIndex: sprite.zIndex,
    };

    appState.project.objects.push(objectState);
    appState.project.layers.unshift({ id: sprite.objectId, name: asset.name, type });
    saveProject(appState.project);
    renderLayers();
    selectObject(sprite);
}

function restoreSceneObject(objectState) {
    const asset = findAssetById(objectState.assetId);
    if (!asset) return;

    const sprite = new PIXI.Sprite.from(asset.src);
    sprite.anchor.set(0.5, 0.5);
    sprite.x = objectState.x;
    sprite.y = objectState.y;
    sprite.scale.set(objectState.scale);
    sprite.rotation = objectState.rotation;
    sprite.alpha = objectState.alpha;
    sprite.visible = objectState.visible;
    sprite.locked = objectState.locked;
    sprite.objectId = objectState.id;
    sprite.assetId = objectState.assetId;
    sprite.objectType = objectState.type;
    sprite.zIndex = objectState.zIndex || 100;
    sprite.interactive = true;
    sprite.buttonMode = true;
    sprite.cursor = 'grab';
    sprite.on('pointerdown', onObjectPointerDown);
    sprite.on('pointerup', onObjectPointerUp);
    sprite.on('pointerupoutside', onObjectPointerUp);
    sprite.on('pointermove', onObjectPointerMove);

    scene.layers.objects.addChild(sprite);
}

function findAssetById(id) {
    if (!appState.project) return null;
    const categories = ['cenarios', 'personagens', 'objetos', 'filtros'];
    for (const category of categories) {
        const asset = appState.project.assets[category].find((item) => item.id === id);
        if (asset) return asset;
    }
    return null;
}

function onObjectPointerDown(event) {
    if (this.locked) return;
    if (appState.activeTool === 'rotate') {
        rotateSelectedObject(15);
        return;
    }

    this.data = event.data;
    this.dragging = true;
    this.cursor = 'grabbing';
    selectObject(this);
}

function onObjectPointerMove() {
    if (!this.dragging || appState.activeTool !== 'move') return;
    const newPosition = this.data.getLocalPosition(this.parent);
    this.x = newPosition.x;
    this.y = newPosition.y;
    updateSelectedObjectState();
    updateProperties();
}

function onObjectPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    this.cursor = 'grab';
    this.data = null;
    updateSelectedObjectState();
    saveProject(appState.project);
}

function selectObject(sprite) {
    appState.selectedObjectId = sprite?.objectId || null;
    updateProperties();
    renderLayers();
}

function getSelectedSceneObject() {
    if (!appState.selectedObjectId) return null;
    return scene.layers.objects.children.find((child) => child.objectId === appState.selectedObjectId) || null;
}

function updateSelectedObjectState() {
    const sprite = getSelectedSceneObject();
    if (!sprite || !appState.project) return;
    const objectState = appState.project.objects.find((item) => item.id === sprite.objectId);
    if (!objectState) return;
    objectState.x = sprite.x;
    objectState.y = sprite.y;
    objectState.scale = sprite.scale.x;
    objectState.rotation = sprite.rotation;
    objectState.alpha = sprite.alpha;
    objectState.visible = sprite.visible;
    objectState.locked = sprite.locked;
    objectState.zIndex = sprite.zIndex;
}

function updateProperties() {
    const sprite = getSelectedSceneObject();
    if (!sprite) {
        dom.propX.textContent = '0';
        dom.propY.textContent = '0';
        dom.propWidth.textContent = '0';
        dom.propHeight.textContent = '0';
        dom.propRotation.textContent = '0°';
        dom.propOpacity.textContent = '100%';
        return;
    }

    dom.propX.textContent = `${Math.round(sprite.x)}`;
    dom.propY.textContent = `${Math.round(sprite.y)}`;
    dom.propWidth.textContent = `${Math.round(sprite.width)}`;
    dom.propHeight.textContent = `${Math.round(sprite.height)}`;
    dom.propRotation.textContent = `${Math.round((sprite.rotation * 180) / Math.PI)}°`;
    dom.propOpacity.textContent = `${Math.round(sprite.alpha * 100)}%`;
}

function renderLayers() {
    dom.layerList.innerHTML = '';
    if (!appState.project) return;

    const ordered = [...appState.project.objects].sort((a, b) => b.zIndex - a.zIndex);
    ordered.forEach((layer) => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        if (appState.selectedObjectId === layer.id) item.classList.add('active');
        const name = findAssetById(layer.assetId)?.name || layer.id;
        item.innerHTML = `
            <div class="layer-info">
                <div class="layer-title">${name}</div>
                <div class="layer-meta">${layer.type} • ${layer.visible ? 'Visível' : 'Oculto'} • ${layer.locked ? 'Travado' : 'Livre'}</div>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="tiny-button" data-action="eye" title="Visibilidade">👁️</button>
                <button class="tiny-button" data-action="lock" title="Travar">🔒</button>
            </div>
        `;
        item.querySelector('[data-action="eye"]').addEventListener('click', () => toggleVisibility(layer.id));
        item.querySelector('[data-action="lock"]').addEventListener('click', () => toggleLayerLock(layer.id));
        item.addEventListener('click', () => {
            const sprite = scene.layers.objects.children.find((child) => child.objectId === layer.id);
            selectObject(sprite);
        });
        dom.layerList.appendChild(item);
    });
}

function toggleVisibility(objectId) {
    const sprite = scene.layers.objects.children.find((child) => child.objectId === objectId);
    if (!sprite) return;
    sprite.visible = !sprite.visible;
    const objectState = appState.project.objects.find((item) => item.id === objectId);
    if (objectState) objectState.visible = sprite.visible;
    saveProject(appState.project);
    renderLayers();
}

function toggleLayerLock(objectId) {
    const sprite = scene.layers.objects.children.find((child) => child.objectId === objectId);
    if (!sprite) return;
    sprite.locked = !sprite.locked;
    const objectState = appState.project.objects.find((item) => item.id === objectId);
    if (objectState) objectState.locked = sprite.locked;
    saveProject(appState.project);
    renderLayers();
}

function toggleSelectedLock() {
    const sprite = getSelectedSceneObject();
    if (!sprite) return;
    sprite.locked = !sprite.locked;
    const objectState = appState.project.objects.find((item) => item.id === sprite.objectId);
    if (objectState) objectState.locked = sprite.locked;
    saveProject(appState.project);
    renderLayers();
}

function duplicateSelectedObject() {
    const sprite = getSelectedSceneObject();
    if (!sprite) return;
    const asset = findAssetById(sprite.assetId);
    if (!asset) return;
    addSceneObject(asset, sprite.objectType);
}

function deleteSelectedObject() {
    const sprite = getSelectedSceneObject();
    if (!sprite) return;
    scene.layers.objects.removeChild(sprite);
    const index = appState.project.objects.findIndex((item) => item.id === sprite.objectId);
    if (index >= 0) appState.project.objects.splice(index, 1);
    const layerIndex = appState.project.layers.findIndex((item) => item.id === sprite.objectId);
    if (layerIndex >= 0) appState.project.layers.splice(layerIndex, 1);
    appState.selectedObjectId = null;
    saveProject(appState.project);
    renderLayers();
    updateProperties();
}

function rotateSelectedObject(angleDegrees) {
    const sprite = getSelectedSceneObject();
    if (!sprite) return;
    sprite.rotation += (angleDegrees * Math.PI) / 180;
    updateSelectedObjectState();
    updateProperties();
    saveProject(appState.project);
}

function createRigForSelected() {
    const sprite = getSelectedSceneObject();
    if (!sprite) {
        alert('Selecione um personagem antes de criar o rig.');
        return;
    }

    if (sprite.objectType !== 'personagem') {
        alert('Selecione um personagem para ativar o rig.');
        return;
    }

    const rigRoot = new PIXI.Container();
    rigRoot.x = sprite.x;
    rigRoot.y = sprite.y;
    rigRoot.zIndex = 9999;
    rigRoot.interactive = true;
    rigRoot.cursor = 'grab';

    const torso = new PIXI.Container();
    torso.y = 0;
    rigRoot.addChild(torso);

    const shoulder = createBone('Ombro', 120, 0xffb700);
    shoulder.container.x = 0;
    shoulder.container.y = -20;
    torso.addChild(shoulder.container);

    const elbow = createBone('Cotovelo', 100, 0xa783ff);
    elbow.container.x = 90;
    elbow.container.y = 0;
    shoulder.container.addChild(elbow.container);

    const wrist = createBone('Pulso', 80, 0x38f5d0);
    wrist.container.x = 90;
    wrist.container.y = 0;
    elbow.container.addChild(wrist.container);

    scene.layers.rig.addChild(rigRoot);
    selectObject(sprite);
}
    rigRoot.x = sprite.x;
    rigRoot.y = sprite.y;
    rigRoot.zIndex = 9999;
    rigRoot.interactive = true;
    rigRoot.cursor = 'grab';

    const torso = new PIXI.Container();
    torso.y = 0;
    rigRoot.addChild(torso);

    const shoulder = createBone('Ombro', 120, 0xffb700);
    shoulder.x = 0;
    shoulder.y = -20;
    torso.addChild(shoulder.container);

    const elbow = createBone('Cotovelo', 100, 0xa783ff);
    elbow.x = 90;
    elbow.y = 0;
    shoulder.container.addChild(elbow.container);

    const wrist = createBone('Pulso', 80, 0x38f5d0);
    wrist.x = 90;
    wrist.y = 0;
    elbow.container.addChild(wrist.container);

    scene.layers.rig.addChild(rigRoot);
    selectObject(sprite);
}

function createBone(label, length, color) {
    const container = new PIXI.Container();
    const line = new PIXI.Graphics();
    line.lineStyle(6, color, 0.75);
    line.moveTo(0, 0);
    line.lineTo(length, 0);
    const joint = new PIXI.Graphics();
    joint.beginFill(color);
    joint.drawCircle(0, 0, 10);
    joint.endFill();
    joint.x = length;
    joint.interactive = true;
    joint.cursor = 'grab';
    joint.on('pointerdown', (event) => {
        container.data = event.data;
        container.dragging = true;
    });
    joint.on('pointermove', function () {
        if (!container.dragging) return;
        const newPosition = container.data.getLocalPosition(container.parent);
        container.rotation = Math.atan2(newPosition.y - container.y, newPosition.x - container.x);
    });
    joint.on('pointerup', () => {
        container.dragging = false;
        container.data = null;
    });
    joint.on('pointerupoutside', () => {
        container.dragging = false;
        container.data = null;
    });

    const labelText = new PIXI.Text(label, { fontSize: 12, fill: 0xffffff });
    labelText.position.set(10, -28);
    container.addChild(line, joint, labelText);
    return { container, line, joint };
}

function captureFrame() {
    if (!appState.project) return;
    const snapshot = scene.app.renderer.plugins.extract.base64(scene.app.stage);
    const frame = {
        id: `frame-${Date.now()}`,
        created: new Date().toISOString(),
        image: snapshot,
        objects: JSON.parse(JSON.stringify(appState.project.objects)),
    };
    appState.project.frames.push(frame);
    saveProject(appState.project);
    renderTimeline();
    renderOnionSkin();
}

function renderTimeline() {
    dom.timelineTrack.innerHTML = '';
    if (!appState.project) return;
    appState.project.frames.forEach((frame, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'timeline-thumb';
        thumb.innerHTML = `
            <img src="${frame.image}" alt="Frame ${index + 1}">
            <div class="timeline-meta"><span>#${String(index + 1).padStart(5, '0')}</span><strong>${new Date(frame.created).toLocaleTimeString()}</strong></div>
        `;
        thumb.addEventListener('click', () => loadFrame(index));
        dom.timelineTrack.appendChild(thumb);
    });

    if (!appState.project.frames.length) {
        dom.timelineTrack.innerHTML = `<div class="timeline-thumb" style="grid-column: span 6; justify-content: center; color: var(--muted);">Nenhum quadro capturado ainda.</div>`;
    }
}

function loadFrame(index) {
    const frame = appState.project.frames[index];
    if (!frame) return;
    clearScene();
    if (appState.project.settings.backgroundUrl) setBackground(appState.project.settings.backgroundUrl, false);
    appState.project.objects = JSON.parse(JSON.stringify(frame.objects));
    appState.project.objects.forEach((objectState) => restoreSceneObject(objectState));
    saveProject(appState.project);
    renderLayers();
    updateToolbar();
    renderOnionSkin();
}

function renderOnionSkin() {
    scene.layers.ghost.removeChildren();
    if (!appState.onion.enabled || !appState.project || !appState.project.frames.length) return;

    const selectedIndex = appState.project.frames.length - 1;
    for (let i = 1; i <= appState.onion.previous; i += 1) {
        const frame = appState.project.frames[selectedIndex - i];
        if (frame) createGhostSprite(frame.image, 0xffbb44);
    }

    for (let i = 1; i <= appState.onion.next; i += 1) {
        const frame = appState.project.frames[selectedIndex + i];
        if (frame) createGhostSprite(frame.image, 0x33d6ff);
    }
}

function createGhostSprite(image, tint) {
    const texture = PIXI.Texture.from(image);
    const sprite = new PIXI.Sprite(texture);
    sprite.width = scene.app.screen.width;
    sprite.height = scene.app.screen.height;
    sprite.alpha = appState.onion.opacity;
    sprite.tint = tint;
    sprite.blendMode = PIXI.BLEND_MODES.SCREEN;
    scene.layers.ghost.addChild(sprite);
}

function exportProject() {
    if (!appState.project) return;
    const json = JSON.stringify(appState.project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, `${appState.project.name.replace(/\s+/g, '_')}.stopmotion.json`);
}

function exportVideo() {
    if (!appState.project || !window.Whammy) {
        alert('A biblioteca de exportação de vídeo não está disponível.');
        return;
    }

    if (!appState.project.frames.length) {
        alert('Capture pelo menos um quadro antes de exportar.');
        return;
    }

    const video = new Whammy.Video(appState.project.settings.fps || 24);
    const promises = appState.project.frames.map((frame) => loadFrameImage(frame.image));
    Promise.all(promises).then((images) => {
        images.forEach((img) => video.add(img));
        const output = video.compile();
        const url = URL.createObjectURL(output);
        downloadFile(url, `${appState.project.name.replace(/\s+/g, '_')}.webm`);
    });
}

function loadFrameImage(dataUrl) {
    return new Promise((resolve) => {
        const image = new Image();
        image.src = dataUrl;
        image.onload = () => resolve(image);
    });
}

function importProjectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || !data.id) throw new Error('Projeto inválido');
            appState.projects.unshift(data);
            saveProject(data);
            loadProject(data.id);
        } catch (error) {
            alert('Não foi possível importar o projeto.');
        }
    };
    reader.readAsText(file);
}

function downloadFile(url, filename) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function updateToolbar() {
    dom.infoFrameCount.textContent = `Quadro ${String(appState.project?.frames?.length || 0).padStart(4, '0')}`;
    dom.infoTimecode.textContent = `00:00:00 | ${appState.project?.settings?.fps || 24} FPS`;
    dom.infoMode.textContent = `Modo: ${appState.activeTool.charAt(0).toUpperCase() + appState.activeTool.slice(1)}`;
    dom.projectName.textContent = appState.project?.name || 'Nenhum projeto selecionado';
    dom.projectDescription.textContent = appState.project?.description || 'Salvo automaticamente no navegador.';
}

initStudio();
