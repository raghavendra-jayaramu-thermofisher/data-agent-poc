const hosts = ['localhost', '127.0.0.1', 'host.docker.internal'];
const portsByKind: Record<string, readonly number[]> = {
  postgres: [5432, 5433, 12202],
  mysql: [3306, 3307],
  mssql: [1433, 14330],
};

export function ConnectionSuggestions({
  kind,
  hostListId,
  portListId,
  driverListId,
}: {
  kind: string;
  hostListId: string;
  portListId: string;
  driverListId: string;
}) {
  return (
    <>
      <datalist id={hostListId}>
        {hosts.map((host) => (
          <option key={host} value={host} />
        ))}
      </datalist>
      {kind === 'mssql' && (
        <datalist id={driverListId}>
          <option value="ODBC Driver 18 for SQL Server" />
          <option value="ODBC Driver 17 for SQL Server" />
        </datalist>
      )}
      <datalist id={portListId}>
        {(portsByKind[kind] ?? []).map((port) => (
          <option key={port} value={port} />
        ))}
      </datalist>
    </>
  );
}
