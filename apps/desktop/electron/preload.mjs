import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("cgraphDesktop", {
  platform: process.platform,
});
