<script lang="ts">
import { defineComponent } from 'vue';
import * as THREE from 'three';
import { DDSLoader } from "~/assets/js/libraries/DDSLoader";
import { markRaw } from "vue";
import * as JSZip from "jszip";
import { readFileAsDataURL, readFileAsText, readDirectory } from "~/assets/ts/fileSystem";
import { parseCodewalkerYdd } from "~/assets/ts/codewalker/parser";
import type {
  ICodewalkerTextureDictionaryItem
} from "~/assets/ts/codewalker/interfaces/ICodewalkerTextureDictionaryItem";
import type { IGeometryData } from "assets/ts/codewalker/interfaces/IGeometryData";

interface IOutputFormat {
  label: string;
  value: string;
  extension: string;
}

interface IComponentData {
  scene: THREE.Scene;
  perspectiveCamera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
  group: THREE.Group;
  cameraHelper: THREE.CameraHelper | null;
  renderer: THREE.WebGLRenderer | null;
  ddsLoader: DDSLoader | null;
  status: {
    generateZip: boolean;
    isWorking: boolean;
    currentFolder: number;
    totalFolders: number;
    currentDrawable: number;
    totalDrawables: number;
  };
  currentFolder: string;

  options: {
    outputFormats: IOutputFormat[];
    outputFormat: IOutputFormat | null;
  };
}

export default defineComponent({
  name: "three",
  data: (): IComponentData => ({
    scene: markRaw(new THREE.Scene()),
    perspectiveCamera: markRaw(new THREE.PerspectiveCamera(75, 1, 0.1, 1000)),
    orthographicCamera: markRaw(new THREE.OrthographicCamera(-10, 10, 10, -10)),
    group: markRaw(new THREE.Group()),

    cameraHelper: null,

    currentFolder: '',

    renderer: null,

    ddsLoader: null,

    options: {
      outputFormats: [
        {
          label: 'WebP',
          value: 'webp',
          extension: 'webp',
        },
        {
          label: 'PNG',
          value: 'png',
          extension: 'png',
        },
      ],
      outputFormat: null,
    },

    status: {
      generateZip: false,
      isWorking: false,

      currentFolder: 0,
      totalFolders: 0,

      currentDrawable: 0,
      totalDrawables: 0,
    },
  }),
  watch: {
    ['options.outputFormat']() {
      if (this.options.outputFormat === null) {
        return;
      }

      localStorage.setItem('outputFormat', this.options.outputFormat.value);
    },
  },
  async mounted() {
    this.buildOptions();

    // this.scene.background = new THREE.Color(0x00ff00);
    // this.cameraHelper = markRaw(new THREE.CameraHelper(this.perspectiveCamera));
    // this.scene.add(this.cameraHelper);

    // this.orthographicCamera.position.x = 0;
    // this.orthographicCamera.position.y = -2;
    this.orthographicCamera.position.x = 0;
    this.orthographicCamera.position.y = -2;
    this.orthographicCamera.position.z = 0;
    // this.cameraHelper = markRaw(new THREE.CameraHelper(this.orthographicCamera));
    // this.scene.add(this.cameraHelper);

    let manager = new THREE.LoadingManager();
    manager.addHandler(/\.dds$/i, new DDSLoader());

    this.ddsLoader = new DDSLoader(manager);

    let renderer = markRaw(new THREE.WebGLRenderer({
      canvas: this.$refs.canvas! as HTMLCanvasElement,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    }));

    renderer.setSize(1024, 1024);

    this.renderer = renderer;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(-2, -2, 5);
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(-2, -2, -2);
    this.scene.add(directionalLight2);

    const alight = new THREE.AmbientLight(0x606060);
    this.scene.add(alight);

    this.scene.add(this.group);
  },
  methods: {
    buildOptions() {
      let outputFormat = localStorage.getItem('outputFormat');

      if (outputFormat) {
        this.options.outputFormat = this.options.outputFormats.find((item) => item.value === outputFormat) || null;
      }

      if (!this.options.outputFormat) {
        this.options.outputFormat = this.options.outputFormats[0];
      }
    },

    renderCurrentModel() {
      if (this.orthographicCamera) {
        this.renderer!.render(this.scene, this.orthographicCamera);
      } else {
        this.renderer!.render(this.scene, this.perspectiveCamera);
      }
    },

    createMaterial() {
      return markRaw(new THREE.MeshPhongMaterial({
        color: 0xffffff,
        // wireframe: true,
      }));
    },

    async loadTexture(filename: string, content: string) {
      console.log(`Loading ${filename} as texture`);
      console.time(`Loading ${filename}`);

      return new Promise<THREE.Texture>((resolve, reject) => {
        this.ddsLoader!.load(
            content,
            // onload
            (texture) => {
              // texture.channel = 0;
              console.timeEnd(`Loading ${filename}`);
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

    setCameraLookAtGroup(group: THREE.Group) {
      let middle = new THREE.Vector3();

      let bb = (new THREE.Box3()).setFromObject(group);

      middle.x = (bb.max.x + bb.min.x) / 2;
      middle.y = (bb.max.y + bb.min.y) / 2;
      middle.z = (bb.max.z + bb.min.z) / 2;

      let worldOrigin = group.localToWorld(middle);

      group.position.x -= worldOrigin.x;
      group.position.y -= worldOrigin.y;
      group.position.z -= worldOrigin.z;

      let bbSizeX = bb.max.x - bb.min.x;
      let bbSizeY = bb.max.z - bb.min.z;
      let bbSizeZ = bb.max.z - bb.min.z;

      let bbSize = Math.max(bbSizeX, bbSizeZ, bbSizeY);

      // let bbHelper = new THREE.BoxHelper(this.group, 0xff0000);
      // this.scene.add(bbHelper);

      if (this.orthographicCamera) {
        this.orthographicCamera.position.x = 0;
        this.orthographicCamera.position.y = -2;
        this.orthographicCamera.position.z = 0;
        this.orthographicCamera.bottom = -bbSize / 2;
        this.orthographicCamera.top = bbSize / 2;
        this.orthographicCamera.left = -bbSize / 2;
        this.orthographicCamera.right = bbSize / 2;

        this.orthographicCamera.up.set(0, 0, 1);
        this.orthographicCamera.lookAt(new THREE.Vector3(0, 0, 0));

        this.orthographicCamera.updateProjectionMatrix();
      }

      if (this.cameraHelper) {
        this.cameraHelper.update();
      }
    },

    async findDrawableAsset(entries: FileSystemEntry[], modelName: string, filename: string) {
      for (let entry of entries) {
        if (entry.isDirectory === false) {
          continue;
        }

        if (entry.name !== `${modelName}_u` && entry.name !== `${modelName}_r` && entry.name !== modelName) {
          continue;
        }

        let content = await readDirectory(entry as FileSystemDirectoryEntry);

        for (let item of content) {
          if (!item.isFile) {
            continue;
          }

          if (item.name === filename) {
            return await readFileAsDataURL(item as FileSystemFileEntry);
          }
        }
      }

      return null;
    },

    canvasToImage(): Promise<Blob> {
      return new Promise((resolve) => {
        // @ts-ignore
        this.$refs.canvas.toBlob((blob: Blob) => {
          resolve(blob);
        }, `image/${this.options.outputFormat!.value}`);
      });
    },

    async findTextures(entries: FileSystemEntry[], modelName: string) {
      let modelNameSegments = modelName.split('_');

      modelNameSegments.splice(-1, 0, 'diff');

      modelName = modelNameSegments.join('_');
      modelName = modelName.replace('_u', '');
      modelName = modelName.replace('_r', '');

      let result = [];

      for (let i = 0; i < entries.length; i++) {

        if (!entries[i].isDirectory) {
          continue;
        }

        if (!entries[i].name.startsWith(`${modelName}_`)) {
          continue;
        }

        let directoryContent = await readDirectory(entries[i] as FileSystemDirectoryEntry);

        for (let item of directoryContent) {

          if (!item.isFile) {
            continue;
          }

          if (!item.name.endsWith('.dds')) {
            continue;
          }

          let content = await readFileAsDataURL(item as FileSystemFileEntry);

          result.push({
            fileName: item.name,
            content
          });
        }
      }

      return result;
    },

    findDrawables(entries: FileSystemEntry[]): FileSystemFileEntry[] {
      let res: FileSystemFileEntry[] = [];

      for (let entry of entries) {
        if (!entry.isFile) {
          continue;
        }

        if (!entry.name.endsWith('.ydd.xml')) {
          continue;
        }

        res.push(entry as FileSystemFileEntry);
      }

      return res;
    },

    loadUvTexture(): Promise<THREE.Texture> {
      return new Promise((resolve, reject) => {
        (new THREE.TextureLoader()).load('/textures/uv_test.png', resolve, undefined, reject);
      });
    },

    getTextureDictionaryByShaderItemName(shaderItemName: string, textureDictionary: ICodewalkerTextureDictionaryItem[]): ICodewalkerTextureDictionaryItem {
      for (let item of textureDictionary) {
        if (item.name === shaderItemName) {
          return item;
        }
      }

      throw new Error('Texture dictionary item not found');
    },

    createGeometryFromYdd(data: IGeometryData) {
      let geometry = new THREE.BufferGeometry();

      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.vertices), 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs[0]), 2));

      if (data.uvs.length >= 2) {
        for (let i = 1; i < data.uvs.length; i++) {
          geometry.setAttribute(`uv${i}`, new THREE.BufferAttribute(new Float32Array(data.uvs[i]), 2));
        }
      }

      geometry.setIndex(data.indices);

      if (data.normals) {
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
      } else {
        console.warn('Cannot find normals, computing them');
        geometry.computeVertexNormals();
      }

      // some models exported from codewalker have NaN tangents
      // if (geometryData.tangent) {
      //   geometry.setAttribute('tangent', new THREE.BufferAttribute(new Float32Array(geometryData.tangent), 4));
      // }

      geometry.computeTangents();

      return geometry;
    },

    async processYdd(entries: FileSystemEntry[], zip: any, zipFolder: any, drawableXmlFile: FileSystemFileEntry) {
      console.groupCollapsed(`Processing ${drawableXmlFile.fullPath}`);

      console.time(`Processing ${drawableXmlFile.name}`);

      // do not use drawableName from parsed YDD because of modded clothes
      let drawableName = drawableXmlFile.name.replace('_u.ydd.xml', '');
      drawableName = drawableName.replace('_r.ydd.xml', '');

      // props have their own naming rules
      if (drawableName.startsWith('p_')) {
        drawableName = drawableName.replace('.ydd.xml', '');
      }

      let zipDrawableFolder = null;

      let drawableXml = await readFileAsText(drawableXmlFile);

      if (!drawableXml) {
        throw new Error('Should never occur');
      }

      let yddData = parseCodewalkerYdd(drawableXml);
      yddData.shaderGroup.textureDictionary

      let material = this.createMaterial();

      for (let geometryData of yddData.geometries) {
        let geometry = this.createGeometryFromYdd(geometryData);

        if (yddData.shaderGroup && yddData.shaderGroup.textureDictionary) {
          let shaders = yddData.shaderGroup.shaders[geometryData.shaderIndex];

          if (shaders.parameters?.BumpSampler) {
            let dict = this.getTextureDictionaryByShaderItemName(shaders.parameters.BumpSampler, yddData.shaderGroup!.textureDictionary);

            let normalMap = await this.findDrawableAsset(entries, drawableName, dict.filename!);

            if (normalMap !== null) {
              let texture = await this.loadTexture(drawableName, normalMap);

              texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

              material.normalMap = texture;
            } else {
              material.normalMap = null;
              console.warn(`Normal map not found for ${drawableName}`);
            }
          }

          if (shaders.parameters?.SpecSampler) {
            let dict = this.getTextureDictionaryByShaderItemName(shaders.parameters.SpecSampler, yddData.shaderGroup!.textureDictionary);

            let specularMap = await this.findDrawableAsset(entries, drawableName, dict.filename!);

            if (specularMap !== null) {
              let texture = await this.loadTexture(drawableName, specularMap);

              texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

              material.specularMap = texture;
              material.specular = new THREE.Color(0x777777);
            } else {
              material.normalMap = null;
              console.warn(`Normal map not found for ${drawableName}`);
            }
          }
        }


        let mesh = new THREE.Mesh(geometry, material);
        this.group.add(mesh);
      }

      this.setCameraLookAtGroup(this.group);

      let textures = await this.findTextures(entries, drawableName);

      let isRendered = false;

      let textureId = 0;

      for (let texture of textures) {
        try {
          let loadedTexture;

          if (texture.fileName.endsWith('.dds')) {
            try {
              loadedTexture = await this.loadTexture(texture.fileName, texture.content);

              loadedTexture.wrapS = loadedTexture.wrapT = THREE.RepeatWrapping;
            } catch (e) {
              console.error(e);
              loadedTexture = await this.loadUvTexture();
            }
          } else {
            loadedTexture = await this.loadUvTexture();
          }

          material.map = loadedTexture;
          // TODO: bugged with mpchristmas berd_003. Need to be fixed
          material.transparent = true;

          this.renderCurrentModel();

          isRendered = true;

          let blob = await this.canvasToImage();

          if (!zipDrawableFolder) {
            zipDrawableFolder = zipFolder.folder(drawableName);
          }

          zipDrawableFolder.file(`${textureId}.${this.options.outputFormat!.extension}`, blob);
          textureId++;
        } catch (e) {
          console.error(e);
        }
      }

      if (!isRendered) {
        this.renderCurrentModel();
      }

      while (this.group.children.length > 0) {
        let child = this.group.children[0];

        // @ts-ignore
        child.geometry.dispose();
        // @ts-ignore
        child.material.dispose();

        this.group.remove(child);
      }

      this.group.position.set(0, 0, 0);

      console.timeEnd(`Processing ${drawableXmlFile.name}`);
      console.groupEnd();
    },

    async traverseDirs(dir: FileSystemDirectoryEntry, zip: any, zipFolderName: string) {
      let entries = await readDirectory(dir);

      let drawables = this.findDrawables(entries);
      // let ydrs = await this.findYdrs(entries);

      this.status.totalDrawables = drawables.length;
      this.status.currentDrawable = 0;

      let zipFolder = zip.folder(zipFolderName);

      this.currentFolder = zipFolderName;

      // for (let ydr of ydrs) {
      //   await this.processYdr(entries, zip, zipFolder, ydr);
      // }

      for (let drawable of drawables) {
        this.status.currentDrawable++;

        await this.processYdd(entries, zip, zipFolder, drawable);
      }
    },

    async traverseFileSystem(item: FileSystemDirectoryEntry) {
      if (this.status.isWorking) {
        return;
      }

      this.status.isWorking = true;

      if (item.isDirectory) {
        let entries = await readDirectory(item);

        let drawables = this.findDrawables(entries);

        if (drawables.length > 0) {
          let zip = new JSZip.default();

          this.status.currentFolder = 1;
          this.status.totalFolders = 1;

          await this.traverseDirs(item, zip, item.name);

          await this.downloadZip(zip, `${item.name}.zip`);
        } else {
          this.status.currentFolder = 0;
          this.status.totalFolders = entries.length;

          for (let i = 0; i < entries.length; i++) {
            if (entries[i].isDirectory === false) {
              continue;
            }

            this.status.currentFolder++;

            let zip = new JSZip.default();

            await this.traverseDirs(entries[i] as FileSystemDirectoryEntry, zip, entries[i].name);

            await this.downloadZip(zip, `${entries[i].name}.zip`);
          }
        }
      }

      this.status.isWorking = false;
    },

    async downloadZip(zip: any, filename: string) {
      this.status.generateZip = true;
      let blob = await zip.generateAsync({ type: "blob" });

      let url = window.URL.createObjectURL(blob);

      let a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      this.status.generateZip = false;
    },

    onDrop(event: DragEvent) {
      if (!event.dataTransfer) {
        return;
      }

      let items = event.dataTransfer.items;

      event.preventDefault();

      for (let i = 0; i < items.length; i++) {
        let item = items[i].webkitGetAsEntry();

        if (!item || item.isDirectory === false) {
          continue;
        }

        if (item) {
          this.traverseFileSystem(item as FileSystemDirectoryEntry);
        }
      }
    }
  },

  computed: {
    getStatusClasses() {
      let classes: string[] = [];

      return classes;
    },
    getStatusString() {
      if (this.status.isWorking) {
        if (this.status.generateZip) {
          return `generating zip`;
        }

        return `working (Folders: ${this.status.currentFolder} / ${this.status.totalFolders}, drawables: ${this.status.currentDrawable} / ${this.status.totalDrawables})`;
      }

      return 'idle';
    },
  },
})
</script>

<template>
  <div class="dropzone" @drop.prevent="onDrop" @dragover.prevent>
    <canvas class="canvas" ref="canvas"></canvas>

    <div class="ui-panel">
      <div class="ui-panel__status">
        Current status: <span class="ui-panel__status" :class="getStatusClasses">{{ getStatusString }}</span>
      </div>

      <select v-model="options.outputFormat">
        <option v-for="option in options.outputFormats" :value="option">{{ option.label }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ui-panel {
  position: absolute;
  top: 24px;
  left: 16px;

  width: 300px;
  padding: 12px;

  border-radius: 5px;

  opacity: .5;

  background-color: rgba(8, 8, 8, 1);

  transition: opacity .3s ease-in-out;

  display: flex;
  flex-direction: column;
  gap: 12px;

  color: #fff;

  &__status {

  }

  &:hover {
    opacity: 1;
  }
}

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