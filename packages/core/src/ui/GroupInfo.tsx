import { useTranslation } from "react-i18next";
import { SPACE_GROUPS, type SpaceGroupId } from "../symmetry/groups";
import { PLANE_GROUP_INFO } from "../symmetry/groupInfo";

/** Inline reference card for the current plane group (symbols + translated prose). */
export function GroupInfo({ id }: { id: SpaceGroupId }) {
  const { t } = useTranslation();
  const info = PLANE_GROUP_INFO[id];
  if (!info) return null;
  const lattice = SPACE_GROUPS[id].lattice;
  const yesNo = (v: boolean) => (v ? t("groupInfo.yes") : t("groupInfo.no"));
  const rotations = info.rotationOrders.length
    ? info.rotationOrders
        .map((n) => t("groupInfo.rotationOrder", { n, deg: 360 / n }))
        .join(t("listSep"))
    : t("groupInfo.none");
  // Third field marks Hermann–Mauguin notation (typeset in italics, as in ITA).
  const rows: [string, string, boolean?][] = [
    [t("groupInfo.itaNumber"), String(info.itaNumber)],
    [t("groupInfo.fullSymbol"), info.fullSymbol, true],
    [t("groupInfo.orbifold"), info.orbifold],
    [t("groupInfo.lattice"), t(`lattice.${lattice}`)],
    [t("groupInfo.pointGroup"), info.pointGroup, true],
    [t("groupInfo.rotations"), rotations],
    [t("groupInfo.mirrors"), yesNo(info.mirrors)],
    [t("groupInfo.glides"), yesNo(info.glides)],
    [
      t("groupInfo.fundamentalDomain"),
      info.copiesPerCell === 1
        ? t("groupInfo.fdWhole")
        : t("groupInfo.fdValue", { n: info.copiesPerCell }),
    ],
  ];
  return (
    <section className="cgraph-groupinfo" aria-live="polite">
      <p className="cgraph-groupinfo-title">
        <strong className="cgraph-symbol">{id}</strong>
      </p>
      <dl>
        {rows.map(([k, v, symbol]) => (
          <div key={k} className="cgraph-groupinfo-row">
            <dt>{k}</dt>
            <dd className={symbol ? "cgraph-symbol" : undefined}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="cgraph-groupinfo-desc">{t(`group.${id}.desc`)}</p>
    </section>
  );
}
