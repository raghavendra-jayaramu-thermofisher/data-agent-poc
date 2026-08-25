let activeOrganizationId: string | null = null;
export function setApiOrganizationId(id: string | null) { activeOrganizationId = id; }
export function getApiOrganizationId() { return activeOrganizationId; }
