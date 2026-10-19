export function dataSourceType(value: string) {
  return (
    (
      { postgres: 'PostgreSQL', mysql: 'MySQL', mssql: 'SQL Server', excel: 'Excel' } as Record<
        string,
        string
      >
    )[value] ?? value
  );
}
