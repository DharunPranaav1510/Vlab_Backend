export type MeshGenerateRdpInput = {
  nodeId: string;
  startIso: string;
  durationMinutes: number;
};

export async function generateMeshDesktopShareCommand(input: MeshGenerateRdpInput) {
  return `meshctrl deviceshare --id ${input.nodeId} --type desktop --start "${input.startIso}" --duration ${input.durationMinutes}`;
}
