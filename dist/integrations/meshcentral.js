export async function generateMeshDesktopShareCommand(input) {
    return `meshctrl deviceshare --id ${input.nodeId} --type desktop --start "${input.startIso}" --duration ${input.durationMinutes}`;
}
