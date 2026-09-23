import Link from "next/link";
import type { ReactNode } from "react";

export type Column<Row> = {
  header: string;
  /** Renders the cell. */
  cell: (row: Row) => ReactNode;
  /** Pushes this column and everything after it to the right. */
  align?: "left" | "right";
  /** Hidden below the given breakpoint, for the columns that matter least. */
  hideBelow?: "sm" | "md" | "lg";
};

const HIDE: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * The list view every admin screen uses.
 *
 * A real table rather than a grid of divs, so a row reads correctly when it is
 * announced and the columns stay aligned as the data changes length.
 */
export function RecordTable<Row extends { id: string }>({
  rows,
  columns,
  hrefFor,
  empty,
  listId,
  searchText,
}: {
  rows: Row[];
  columns: Column<Row>[];
  /** When given, the first cell becomes the link into the record. */
  hrefFor?: (row: Row) => string;
  empty: ReactNode;
  /**
   * id for the tbody, so OrderSearch can filter these rows as you type.
   * Pair it with searchText; on its own it does nothing.
   */
  listId?: string;
  /** The text a live search matches a row against. */
  searchText?: (row: Row) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-line bg-card px-6 py-12 text-center">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line-soft">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`px-5 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-quiet ${
                  column.align === "right" ? "text-right" : ""
                } ${column.hideBelow ? HIDE[column.hideBelow] : ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody id={listId}>
          {rows.map((row) => (
            <tr
              key={row.id}
              data-search={searchText ? searchText(row) : undefined}
              className="border-b border-line-soft last:border-b-0 hover:bg-surface-grey/60"
            >
              {columns.map((column, index) => (
                <td
                  key={column.header}
                  className={`px-5 py-3.5 align-middle text-[13px] ${
                    column.align === "right" ? "text-right" : ""
                  } ${column.hideBelow ? HIDE[column.hideBelow] : ""}`}
                >
                  {index === 0 && hrefFor ? (
                    <Link
                      href={hrefFor(row)}
                      className="font-semibold text-accent-text hover:underline"
                    >
                      {column.cell(row)}
                    </Link>
                  ) : (
                    column.cell(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
