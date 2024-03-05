<script lang="ts">
import { defineComponent } from 'vue';
import * as THREE from 'three';
import { DDSLoader } from "~/libraries/DDSLoader";
import { markRaw } from "vue";
import * as JSZip from "jszip";

export default defineComponent({
  name: "three",
  data: () => ({
    // geometry: null,
    meshes: markRaw([]),
    scene: null,
    camera: null,
    debugCamera: null,
    texture: null,
    normalMap: null,
    specularMap: null,
    material: null,
    group: null,

    cameraHelper: null,

    currentFolder: null,

    renderer: null,
  }),
  async mounted() {
    this.scene = markRaw(new THREE.Scene());
    // this.scene.background = new THREE.Color(0x00ff00);
    this.camera = markRaw(new THREE.PerspectiveCamera(75, 1, 0.1, 1000));
    // this.cameraHelper = markRaw(new THREE.CameraHelper(this.camera));
    // this.scene.add(this.cameraHelper);

    this.debugCamera = markRaw(new THREE.OrthographicCamera(-10, 10, 10, -10));
    // this.debugCamera.position.x = 0;
    // this.debugCamera.position.y = -2;
    this.debugCamera.position.x = 0;
    this.debugCamera.position.y = -2;
    this.debugCamera.position.z = 0;
    // this.cameraHelper = markRaw(new THREE.CameraHelper(this.debugCamera));
    // this.scene.add(this.cameraHelper);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.$refs.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(1024, 1024);

    let manager = new THREE.LoadingManager();
    manager.addHandler(/\.dds$/i, new DDSLoader());

    console.log(manager);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(-2, -2, 5);
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(-2, -2, -2);
    this.scene.add(directionalLight2);

    const alight = new THREE.AmbientLight(0x717171); // soft white light
    // const alight = new THREE.AmbientLight(0xffffff); // soft white light
    this.scene.add(alight);
  },
  methods: {
    renderCurrentModel() {
      // console.log(this.scene);

      if (this.debugCamera) {
        // if (false) {
        this.renderer.render(this.scene, this.debugCamera);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    },

    getDrawableLayoutOffsets(doc) {
      doc = doc.querySelector('Layout');

      let layoutProperties = {
        Position: 3, // Vector3
        BlendWeights: 4, // Color4
        BlendIndices: 4, // Color4
        Normal: 3, // Vector3
        Colour0: 4, // Color4
        Colour1: 4, // Color4
        TexCoord0: 2, // Vector2
        Tangent: 4, // Vector4
      };

      let offsets = {};

      let currentOffset = 0;

      for (let child of doc.children) {
        if (layoutProperties.hasOwnProperty(child.tagName)) {
          offsets[child.tagName] = currentOffset;
          currentOffset += layoutProperties[child.tagName];
        }
      }

      return offsets;
    },

    getDrawableNormalMapNameTagValue(doc) {
      let shaders = doc.querySelector('Shaders');

      if (!shaders) {
        return null;
      }

      let parameters = shaders.querySelector('Parameters');

      if (!parameters) {
        return null;
      }

      let param = parameters.querySelector('Item[name=BumpSampler]');

      if (!param) {
        return null;
      }

      let name = param.querySelector('Name');

      if (!name) {
        return null;
      }

      return name.innerHTML;
    },

    getDrawableSpecularMapNameTagValue(doc) {
      let shaders = doc.querySelector('Shaders');

      if (!shaders) {
        return null;
      }

      let parameters = shaders.querySelector('Parameters');

      if (!parameters) {
        return null;
      }

      let param = parameters.querySelector('Item[name=SpecSampler]');

      if (param) {
        return param.querySelector('Name').innerHTML;
      }

      return null;
    },

    getFilenameByNameValue(doc, nameValue) {
      doc = doc.querySelector('TextureDictionary');

      if (!doc) {
        console.warn('No TextureDictionary found');
        return null;
      }

      for (let item of doc.children) {
        if (item.tagName !== 'Item') {
          throw new Error('Invalid tagName');
        }

        let name = item.querySelector('Name');

        if (name.innerHTML === nameValue) {
          return item.querySelector('FileName').innerHTML;
        }
      }

      return null;
    },

    // Verticies, UVs, Indexes from xml, every item
    getGeometriesData(el) {
      let indexBuffer = el.querySelector('IndexBuffer');
      let indexEl = indexBuffer.querySelector('Data');

      if (!indexEl) {
        indexEl = indexBuffer.querySelector('Data2');

        if (!indexEl) {
          console.error('No index data found');
          return;
        }
      }

      let indexData = indexEl.innerHTML;

      indexData = indexData.split('\n').join(' ');
      indexData = indexData.replace(/ +(?= )/g, '');
      indexData = indexData.trim().split(' ');

      el = el.querySelector('VertexBuffer');
      let offsets = this.getDrawableLayoutOffsets(el);

      if (!offsets.hasOwnProperty('Position') || !offsets.hasOwnProperty('TexCoord0')) {
        console.error('Invalid offsets', offsets);
        return;
      }

      let vertexBufferEl = el.querySelector('Data');

      if (!vertexBufferEl) {
        vertexBufferEl = el.querySelector('Data2');
      }

      if (!vertexBufferEl) {
        console.error('No vertex buffer data found');
        return;
      }

      let plain = vertexBufferEl.innerHTML.replace(/ +(?= )/g, '');

      let strings = plain.split('\n');

      let data = strings.map(string => string.trim().split(' '));

      if (data[0] && data[0].length === 1) {
        data.shift();
      }

      let vertices = [];
      let uv = [];
      let uv2 = [];
      let indexes = [];
      let tangent = [];
      let normals = [];

      let positionOffset = offsets['Position'];
      let uvOffset = offsets['TexCoord0'];
      let uv2Offset = offsets['TexCoord1'];
      let tangentOffset = offsets['Tangent'];
      let normalOffset = offsets['Normal'];

      let parseTangent = true;

      // console.log('offsets', offsets);

      let uvWarnings = [];

      for (let item of strings) {
        if (!item) {
          continue;
        }

        item = item.trim();

        item = item.split(' ');

        if (!item || !item[0]) {
          continue;
        }

        let [vx, vy, vz] = [parseFloat(item[positionOffset]), parseFloat(item[positionOffset + 1]), parseFloat(item[positionOffset + 2])];

        if (isNaN(vx) || isNaN(vy) || isNaN(vz)) {
          throw new Error('VertexBuffer has nulls');
        }

        vertices.push(vx, vy, vz);

        let uvValue = parseFloat(item[uvOffset]);
        let uvValue2 = parseFloat(item[uvOffset + 1]);

        // TODO: фиксит berd_007 и другие маски из mpvinewood.
        // надо разобраться и написать нормальный код
        if (uvValue > 1 || uvValue < 0) {
          uvValue = uvValue % 1;

          if (uvValue < 0) {
            uvValue = 1 + uvValue;
          }
        }

        uv.push(uvValue, uvValue2);

        if (uv2Offset !== undefined) {
          let uv2Value = parseFloat(item[uv2Offset]);
          let uv2Value2 = parseFloat(item[uv2Offset + 1]);
          uv2.push(uv2Value, uv2Value2);
        }

        // low quality mods have no tangents (or they're 0 0 0 0), disabled until UI is implemented
        // if (tangent !== undefined && parseTangent === true) {
        //   let tangentX = parseFloat(item[tangentOffset]);
        //   let tangentY = parseFloat(item[tangentOffset + 1]);
        //   let tangentZ = parseFloat(item[tangentOffset + 2]);
        //   let tangentsUNK = parseFloat(item[tangentOffset + 3]);
        //
        //   // sometimes codewalker produces invalid tangent data, so we need to handle this
        //   if (isNaN(tangentX) || isNaN(tangentY) || isNaN(tangentZ) || isNaN(tangentsUNK)) {
        //     console.warn('Tangent is NaN, ignoring next tangents');
        //     parseTangent = false;
        //     tangent = [];
        //   }
        //
        //   if (parseTangent) {
        //     tangent.push(tangentX, tangentY, tangentZ, tangentsUNK);
        //   }
        // }

        if (normalOffset !== undefined) {
          let normalX = parseFloat(item[normalOffset]);
          let normalY = parseFloat(item[normalOffset + 1]);
          let normalZ = parseFloat(item[normalOffset + 2]);

          if (isNaN(normalX) || isNaN(normalY) || isNaN(normalZ)) {
            console.log(normalX, normalY, normalZ);
            throw new Error('Cannot parse normal');
          }

          normals.push(normalX, normalY, normalZ);
        }
      }

      for (let index of indexData) {
        indexes.push(index);
      }

      if (uvWarnings.length) {
        console.warn('UV warnings', offsets, uvWarnings);
      }

      return {
        vertices,
        uv,
        uv2,
        indexes,
        tangent,
        normals,
      }
    },

    loadDrawableXml(_fileName, content) {
      for (let mesh of this.meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();

        this.scene.remove(mesh);
      }

      this.meshes = markRaw([]);

      const parser = new DOMParser();

      let xmlDoc = parser.parseFromString(content, "text/xml");

      let normalMapNameValue = this.getDrawableNormalMapNameTagValue(xmlDoc);
      let normalMapName = this.getFilenameByNameValue(xmlDoc, normalMapNameValue);

      let specularMapNameValue = this.getDrawableNormalMapNameTagValue(xmlDoc);
      let specularMapName = this.getFilenameByNameValue(xmlDoc, specularMapNameValue);

      let el = xmlDoc.querySelector('DrawableModelsHigh');

      el = el.querySelector('Item');
      el = el.querySelector('Geometries');

      for (let geometryXml of el.children) {
        let { vertices, uv, uv2, indexes, tangent, normals } = this.getGeometriesData(geometryXml);

        let geometry = markRaw(new THREE.BufferGeometry());// this.geometry = markRaw(new THREE.BufferGeometry());
        vertices = new Float32Array(vertices);
        uv = new Float32Array(uv);

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

        if (uv2 && uv2.length) {
          uv2 = new Float32Array(uv2);
          geometry.setAttribute('uv3', new THREE.BufferAttribute(uv2, 2));
        }

        geometry.setIndex(indexes);

        if (tangent && tangent.length) {
          tangent = new Float32Array(tangent);
          geometry.setAttribute('tangent', new THREE.BufferAttribute(tangent, 4));
        }

        if (normals && normals.length) {
          normals = new Float32Array(normals);
          geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
          geometry.computeVertexNormals();
          console.warn('Cannot find normals, computing them');
        }

        if (!this.material) {
          this.material = this.createMaterial();
        }

        let mesh = markRaw(new THREE.Mesh(geometry, this.material));
        this.group.add(mesh);
      }

      return {
        normalMapFilename: normalMapName,
        specularMapFilename: specularMapName,
      };
    },

    createMaterial() {
      return markRaw(new THREE.MeshPhongMaterial({
        color: 0xffffff,
        // wireframe: true,
      }));
    },

    loadNormalMap(filename, content) {
      console.log(`Loading ${filename} as normal map`);

      let manager = new THREE.LoadingManager();
      manager.addHandler(/\.dds$/i, new DDSLoader());

      return new Promise((resolve, reject) => {
        new DDSLoader(manager).load(content,
            (texture) => {
              if (!this.material) {
                this.material = this.createMaterial();
              }

              this.material.normalMap = texture;
              this.material.needsUpdate = true;

              resolve(texture);
            },
            undefined,
            (e) => {
              reject(e);
            });
      });
    },

    loadSpecularMap(filename, content) {
      console.log(`Loading ${filename} as specular map`);

      let manager = new THREE.LoadingManager();
      manager.addHandler(/\.dds$/i, new DDSLoader());

      return new Promise((resolve, reject) => {
        new DDSLoader(manager).load(content,
            (texture) => {
              if (!this.material) {
                this.material = this.createMaterial();
              }

              // this.material.specularMap = texture;
              // this.material.needsUpdate = true;

              resolve(texture);
            },
            undefined,
            (e) => {
              reject(e);
            });
      });
    },

    async loadTexture(filename, content) {
      console.log(`Loading ${filename} as texture`);

      return new Promise((resolve, reject) => {
        let manager = new THREE.LoadingManager();
        manager.addHandler(/\.dds$/i, new DDSLoader());

        new DDSLoader(manager).load(
            content,
            // onload
            (texture) => {
              // texture.channel = 0;
              resolve(texture);
            },
            undefined,
            // onerror
            (e) => {
              reject(e);
            }
        );
      });
    },

    async clearCurrentScene() {
      if (!this.scene) {
        return;
      }

      // for (let mesh of this.meshes) {
      //   mesh.geometry.dispose();
      //   mesh.material.dispose();
      //
      //   this.scene.remove(mesh);
      // }

      this.meshes = markRaw([]);

      // this.scene.dispose();
      //
      // this.scene = markRaw(new THREE.Scene());
    },

    pointFrustumAtGeometry() {
      // if (!this.meshes || !this.meshes[0]) {
      //   return;
      // }

      let middle = new THREE.Vector3();

      let bb = (new THREE.Box3()).setFromObject(this.group);

      middle.x = (bb.max.x + bb.min.x) / 2;
      middle.y = (bb.max.y + bb.min.y) / 2;
      middle.z = (bb.max.z + bb.min.z) / 2;

      let worldOrigin = this.group.localToWorld(middle);

      // if (this.meshes.length > 1) {
      //   let delta = new THREE.Vector3().subVectors(this.meshes[0].position, worldOrigin);
      //
      //   for (let i = 1; i < this.meshes.length; i++) {
      //     this.meshes[i].position.add(delta);
      //   }
      // }

      // this.meshes[0].position.x = -worldOrigin.x;
      // this.meshes[0].position.y = -worldOrigin.y;
      // this.meshes[0].position.z = -worldOrigin.z;
      this.group.position.x -= worldOrigin.x;
      this.group.position.y -= worldOrigin.y;
      this.group.position.z -= worldOrigin.z;

      // var boundingSphere = new THREE.Sphere();
      // geometry.boundingBox.getBoundingSphere(boundingSphere);
      // console.log(boundingSphere);

// Get the radius of the bounding sphere
//       var radius = boundingSphere.radius;

      // console.log('radius', radius);

// Calculate the camera distance using the vertical field of view and aspect ratio of the camera
//       var verticalFOV = this.camera.fov * Math.PI / 180; // Convert fov to radians
//       var distance = radius / Math.sin(verticalFOV / 2);

// Calculate the horizontal distance
//       var horizontalDistance = distance / Math.sqrt(1 + Math.pow(this.camera.aspect, 2));

// Use the maximum distance as the camera's distance to the bounding sphere's center
//       var cameraDistance = Math.max(distance, horizontalDistance);


      // console.log(cameraDistance);
// Set the camera's position
//       this.camera.position.copy(boundingSphere.center);
//       console.log(this.camera);
//       this.camera.position.y = -cameraDistance;
//       this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      // console.log(this.camera);
//       this.camera.updateProjectionMatrix();

      // let meshBbWidth = Math.abs(geometry.boundingBox.max.y) + Math.abs(geometry.boundingBox.min.y);
      let bbSizeX = bb.max.x - bb.min.x;
      let bbSizeY = bb.max.z - bb.min.z;
      let bbSizeZ = bb.max.z - bb.min.z;

      let bbSize = Math.max(bbSizeX, bbSizeZ, bbSizeY);

      // let bbHelper = new THREE.BoxHelper(this.meshes[0], 0xff0000);
      // this.scene.add(bbHelper);

      // let fovRadians = this.camera.fov * (Math.PI / 180);
      //
      // let distance = (bbSize / 2) / Math.tan(fovRadians / 2);
      //
      // this.camera.position.y = -distance;
      // this.camera.lookAt(new THREE.Vector3(0, 0, 0));
      //
      // console.log(geometry.boundingBox);

      if (this.debugCamera) {
        this.debugCamera.position.x = 0;
        this.debugCamera.position.y = -2;
        this.debugCamera.position.z = 0;
        this.debugCamera.bottom = -bbSize / 2;
        this.debugCamera.top = bbSize / 2;
        this.debugCamera.left = -bbSize / 2;
        this.debugCamera.right = bbSize / 2;

        // const viewport = 10;
        //
        // this.debugCamera.bottom = -viewport;
        // this.debugCamera.top = viewport;
        // this.debugCamera.left = -viewport;
        // this.debugCamera.right = viewport;

        // this.debugCamera.position = new THREE.Vector3(0, -5, 0);

        this.debugCamera.up.set(0, 0, 1);
        this.debugCamera.lookAt(new THREE.Vector3(0, 0, 0));

        this.debugCamera.updateProjectionMatrix();
      }

      if (this.cameraHelper) {
        this.cameraHelper.update();
      }
    },

    async findNormalMap(entries, modelName, filename) {
      for (let entry of entries) {
        if (entry.isFile) {
          continue;
        }

        if (entry.name !== `${modelName}_u` && entry.name !== `${modelName}_r`) {
          continue;
        }

        let content = await this.readDirectory(entry);

        for (let item of content) {
          if (!item.isFile) {
            continue;
          }

          if (item.name === filename) {
            return await this.readFile(item);
          }
        }
      }

      return null;
    },

    async readFile(fileEntry, asText = false) {
      return new Promise((resolve) => {
        fileEntry.file((file) => {
          let reader = new FileReader();

          reader.onload = (e) => {
            resolve(e.target.result);
          }

          if (asText) {
            reader.readAsText(file);
          } else {
            reader.readAsDataURL(file);
          }
        });
      });
    },

    readDirectory(directory) {
      let directoryReader = directory.createReader();

      let res = [];

      return new Promise((resolve) => {
        let cb = (entries) => {
          if (entries.length) {
            res.push(...entries);

            directoryReader.readEntries(cb);
          } else {
            resolve(res);
          }
        };

        directoryReader.readEntries(cb);
      });
    },

    isTextureDirectory(name) {
      return name.endsWith('_uni') || name.endsWith('_whi');
    },

    canvasToPng() {
      return new Promise((resolve) => {
        this.$refs.canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      });
    },

    async findTextures(entries, modelName) {
      let modelNameSegments = modelName.split('_');

      modelNameSegments.splice(-1, 0, 'diff');

      modelName = modelNameSegments.join('_');

      let result = [];

      for (let i = 0; i < entries.length; i++) {

        if (!entries[i].isDirectory) {
          continue;
        }

        if (!entries[i].name.startsWith(modelName) || !this.isTextureDirectory(entries[i].name)) {
          continue;
        }

        let directoryContent = await this.readDirectory(entries[i]);

        for (let item of directoryContent) {

          if (!item.isFile) {
            continue;
          }

          if (!item.name.endsWith('.dds')) {
            continue;
          }

          let content = await this.readFile(item);

          result.push({
            fileName: item.name,
            content
          });
        }
      }

      return result;
    },

    async findDrawables(entries) {
      let res = [];

      for (let entry of entries) {
        if (!entry.isFile) {
          continue;
        }

        if (!entry.name.endsWith('.ydd.xml')) {
          continue;
        }

        res.push(entry);
      }

      return res;
    },

    async findYdrs(entries) {
      let res = [];

      for (let entry of entries) {
        if (!entry.isFile) {
          continue;
        }

        if (!entry.name.endsWith('.ydr.xml')) {
          continue;
        }

        res.push(entry);
      }

      return res;
    },

    async processYdr(entries, zip, zipFolder, drawable) {
      let drawableFileName = drawable.name;
      let drawableName = drawableFileName.replace('.ydr.xml', '');

      let zipDrawableFolder = zipFolder.folder(drawableName);

      let {
        normalMapFilename,
        specularMapFilename
      } = this.loadDrawableXml(drawable.name, await this.readFile(drawable, true));

      let textures = await this.findTextures(entries, drawableName);

      this.pointFrustumAtGeometry();

      let material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
      });

      // console.log(textures);
      for (let texture of textures) {
        // if (!["w_ar_specialcarbinemk2_l1.dds"].includes(texture.fileName)) {
        //   continue;
        // }

        if (texture.fileName === 'w_ar_specialcarbinemk2_l1_n.dds') {
          let loadedTexture = await this.loadTexture(texture.fileName, texture.content);
          material.normalMap = loadedTexture;

          console.log('normal map');
        }

        if (texture.fileName === 'w_ar_specialcarbinemk2_s.dds') {
          let loadedTexture = await this.loadTexture(texture.fileName, texture.content);
          material.map = loadedTexture;

          console.log('normal map');
        }

        if (texture.fileName === 'w_ar_specialcarbinemk2_l1_s.dds') {
          let loadedTexture = await this.loadTexture(texture.fileName, texture.content);
          // material.specularMap = loadedTexture;

          console.log('normal map');
        }
      }

      for (let mesh of this.meshes) {
        mesh.material = material;
      }

      this.renderCurrentModel();

      let blob = await this.canvasToPng();
      zipDrawableFolder.file(`${drawableName}.png`, blob);
    },

    loadUvTexture() {
      return new Promise((resolve) => {
        (new THREE.TextureLoader()).load('/textures/uv_test.png', resolve);
      });
    },

    async processYdd(entries, zip, zipFolder, drawable) {
      console.groupCollapsed(`Processing ${drawable.name}`);

      console.time(`Processing ${drawable.name}`);

      let drawableFileName = drawable.name;
      let drawableName = drawableFileName.replace('_u.ydd.xml', '');
      drawableName = drawableName.replace('_r.ydd.xml', '');

      let zipDrawableFolder = null;

      if (this.group) {
        this.scene.remove(this.group);
      }

      this.group = markRaw(new THREE.Group());
      this.scene.add(this.group);

      let {
        normalMapFilename,
        specularMapFilename
      } = this.loadDrawableXml(drawable.name, await this.readFile(drawable, true));

      let normalMap = await this.findNormalMap(entries, drawableName, normalMapFilename);

      if (normalMap !== null) {
        await this.loadNormalMap(drawableName, normalMap);
      } else {
        this.material.normalMap = null;
        this.material.needsUpdate = true;
        console.warn(`Normal map not found for ${drawableName}`);
      }

      let specularMap = await this.findNormalMap(entries, drawableName, specularMapFilename);

      if (specularMap !== null) {
        await this.loadSpecularMap(drawableName, specularMap);
      } else {
        this.material.specularMap = null;
        this.material.needsUpdate = true;
        console.warn(`Specular map not found for ${drawableName}`);
      }

      let textures = await this.findTextures(entries, drawableName);

      // console.log(textures);

      if (!textures.length) {
        console.warn(`Textures not found for ${drawableName}, loading test UV texture`);

        textures = [
          {
            fileName: 'uv_test.png',
          }
        ];
      }

      this.pointFrustumAtGeometry();

      for (let texture of textures) {
        try {
          let loadedTexture;

          if (texture.fileName.endsWith('.dds')) {
            try {
              loadedTexture = await this.loadTexture(texture.fileName, texture.content);
            } catch (e) {
              console.error(e);
              loadedTexture = await this.loadUvTexture();
            }
          } else {
            loadedTexture = await this.loadUvTexture();
          }

          if (!this.material) {
            this.material = this.createMaterial();
          }

          this.material.map = loadedTexture;
          this.material.needsUpdate = true;

          this.renderCurrentModel();

          let blob = await this.canvasToPng();

          if (!zipDrawableFolder) {
            zipDrawableFolder = zipFolder.folder(drawableName);
          }

          zipDrawableFolder.file(texture.fileName.replace('.dds', '.png'), blob);
        } catch (e) {
          console.error(e);
        }
      }

      console.timeEnd(`Processing ${drawable.name}`);

      console.groupEnd(`Processing ${drawable.name}`);
    },

    async traverseDirs(dir, zip, zipFolderName) {
      let entries = await this.readDirectory(dir);

      let drawables = await this.findDrawables(entries);
      let ydrs = await this.findYdrs(entries);

      let zipFolder = zip.folder(zipFolderName);

      this.currentFolder = zipFolderName;

      for (let ydr of ydrs) {
        await this.processYdr(entries, zip, zipFolder, ydr);
      }

      for (let drawable of drawables) {
        await this.processYdd(entries, zip, zipFolder, drawable);
      }
    },

    async traverseFileSystem(item) {
      if (item.isDirectory) {
        let entries = await this.readDirectory(item);

        let drawables = await this.findDrawables(entries);

        if (drawables.length > 0) {
          let zip = new JSZip.default();

          await this.traverseDirs(item, zip, item.name);

          let content = await zip.generateAsync({ type: "blob" });

          this.downloadZip(`${item.name}.zip`, content);
        } else {
          for (let i = 0; i < entries.length; i++) {
            let zip = new JSZip.default();

            await this.traverseDirs(entries[i], zip, entries[i].name);

            let content = await zip.generateAsync({ type: "blob" });

            this.downloadZip(`${entries[i].name}.zip`, content);
          }
        }
      }
    },

    downloadZip(filename, blob) {
      let url = window.URL.createObjectURL(blob);

      let a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    },

    onDrop(event) {
      let items = event.dataTransfer.items;

      event.preventDefault();

      for (let i = 0; i < items.length; i++) {
        let item = items[i].webkitGetAsEntry();

        if (item) {
          this.traverseFileSystem(item);
        }
      }
    }
  },
})
</script>

<template>
  <div class="dropzone" @drop.prevent="onDrop" @dragover.prevent>
    <canvas class="canvas" ref="canvas"></canvas>
  </div>
</template>

<style scoped lang="scss">
.dropzone {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  position: absolute;
}

.canvas {
  width: 1024px;
  height: 1024px;
}
</style>