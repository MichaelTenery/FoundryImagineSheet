// @START (CODE)
// @MARKER SHAPE CHANGE VIEW
//==================================================================================================================
// What the shape-change window shows, worked out without Foundry so the test renders the same template against
// the same view. One window, four of his panels: UPDATE CHANGELING RACE, UPDATE FORMLESS HOST, RETAIN FORMLESS
// HOST and FORMLESS FREE PSYCHE CHECK (his sheet's HTML 52712-53110). Each opens with his refusal when the
// character is not that race, worded as his is.
//==================================================================================================================

import { CHANGELING_FORMS, CHANGELING_NATURAL, FORMLESS_HOST_TYPES, FORMLESS_RETAIN_PENALTY,
         getChangelingFormMods } from "./shape-change-rules.mjs";

	// The four panels, in his dropdown's order.
	//      kind                 his value                       title
	export const SHAPE_CHANGE_KINDS = [
		[ "changeling",        "update_changeling_race",       "Update Changeling Race"      ],
		[ "formlessHost",      "update_formless_race",         "Update Formless Host"        ],
		[ "formlessRetention", "update_formless_retention",    "Retain Formless Host"        ],
		[ "formlessPsyche",    "update_formless_free_psyche",  "Formless Free Psyche Check"  ]
	];

	// His all_frames.
	export const SHAPE_FRAMES = [ "Wispy", "Light", "Medium", "Heavy", "Extra-Heavy", "Tremendous" ];

	// This is the function which builds everything the window renders.
	//
	//   tmpkind   one of SHAPE_CHANGE_KINDS
	//   tmpfacts = {
	//       name, raceName, isChangeling, isFormless, hasHost,
	//       changeling: identity.changeling, formless: identity.formless,
	//       formlessHosts  the psyche race's formlessHosts list
	//       control        identity.formlessControl
	//       wil, wilSave   Will Force's value and save
	//       heightFeet, heightInches   the height now
	//   }
	//   tmpworking  the window's own unsaved inputs
	export function buildShapeChangeView(tmpkind, tmpfacts, tmpworking = {}) {
		var tmpf = tmpfacts ?? {};
		var tmpw = tmpworking ?? {};
		var tmprow = SHAPE_CHANGE_KINDS.find(tmpk => tmpk[0] == tmpkind) ?? SHAPE_CHANGE_KINDS[0];
		var tmpview = {
			kind: tmprow[0], title: tmprow[2], name: tmpf.name ?? "",
			kinds: SHAPE_CHANGE_KINDS.map(tmpk => ({ value: tmpk[0], label: tmpk[2], selected: tmpk[0] == tmprow[0] })),
			working: tmpw,
			frames: SHAPE_FRAMES.map(tmpframe => ({ value: tmpframe, selected: tmpframe == tmpw.frame })),
			blocked: "", isChangeling: false, isFormlessHost: false, isRetention: false, isPsyche: false
		};
		var tmprace = tmpf.raceName || "of no race";

		if (tmprow[0] == "changeling") {
			if (!tmpf.isChangeling) { tmpview.blocked = `${tmpview.name} is ${tmprace} and not a Changeling. Cannot change race.`; return tmpview; }
			var tmpcurrent = tmpf.changeling?.form || CHANGELING_NATURAL;
			var tmpchosen = tmpw.form || tmpcurrent;
			var tmpmods = getChangelingFormMods(tmpchosen, tmpf.changeling?.originalForm);
			var tmporig = parseInt(tmpf.changeling?.origHeightInches) || ((parseInt(tmpf.heightFeet) || 0) * 12 + (parseInt(tmpf.heightInches) || 0));
			Object.assign(tmpview, {
				isChangeling: true,
				currentForm: tmpcurrent,
				forms: CHANGELING_FORMS.map(([tmpvalue, tmplabel]) => ({ value: tmpvalue, label: tmplabel, selected: tmpvalue == tmpchosen })),
				formMods: [ "str", "agl", "vit", "app" ].map(tmpkey => ({ key: tmpkey.toUpperCase(), value: tmpmods[tmpkey] }))
					.filter(tmpmod => tmpmod.value).map(tmpmod => `${tmpmod.key} ${tmpmod.value > 0 ? "+" : ""}${tmpmod.value}`).join(", ") || "none",
				origHeight: `${Math.floor(tmporig / 12)}' ${tmporig % 12}"`,
				slight: (tmpw.slight === undefined) ? !!tmpf.changeling?.slight : !!tmpw.slight
			});
			return tmpview;
		}

		if (!tmpf.isFormless) {
			var tmprefusal = {
				formlessHost:      "Cannot possess a new host.",
				formlessRetention: "Is not possessing a host.",
				formlessPsyche:    "No free psyche to check."
			}[tmprow[0]];
			tmpview.blocked = `${tmpview.name} is ${tmprace} and not a Formless. ${tmprefusal}`;
			return tmpview;
		}

		if (tmprow[0] == "formlessHost") {
			Object.assign(tmpview, {
				isFormlessHost: true,
				control: tmpf.control ?? 0,
				hosts: (tmpf.formlessHosts ?? []).map(tmphost => ({ value: tmphost, selected: tmphost == tmpw.host })),
				hostTypes: FORMLESS_HOST_TYPES.filter(tmpt => tmpt[2]).map(tmpt => ({ value: tmpt[0], selected: tmpt[0] == tmpw.hostType })),
				attributes: [ "str", "agl", "vit", "app", "soc" ].map(tmpkey => ({ key: tmpkey, label: tmpkey.toUpperCase(),
					value: tmpw.attributes?.[tmpkey] ?? "", max: tmpf.hostLimits?.[tmpkey] ?? "" }))
			});
			return tmpview;
		}

		if (tmprow[0] == "formlessRetention") {
			if (!tmpf.hasHost) { tmpview.blocked = `${tmpview.name} is a Formless with no host to retain.`; return tmpview; }
			var tmpfl = tmpf.formless ?? {};
			Object.assign(tmpview, {
				isRetention: true,
				currentHost: tmpfl.currentHost || tmpf.hostName || "",
				hostType: tmpfl.hostType || "(not recorded)",
				periodsOccupied: tmpfl.periodsOccupied ?? 0,
				maxPeriods: tmpfl.maxPeriods ?? 0,
				periodType: tmpfl.periodType || "period",
				control: tmpf.control ?? 0,
				retainPenalty: FORMLESS_RETAIN_PENALTY
			});
			return tmpview;
		}

		// formlessPsyche
		if (tmpf.hasHost) { tmpview.blocked = `${tmpview.name} is a Formless but has a current host. No free psyche to check.`; return tmpview; }
		Object.assign(tmpview, {
			isPsyche: true,
			maxPeriods: tmpf.formless?.maxPeriods ?? 0,
			will: tmpf.formless?.freePsycheWill ?? 0,
			control: tmpf.control ?? 0,
			wilSave: tmpf.wilSave ?? 0
		});
		return tmpview;
	}
// @END (CODE)
