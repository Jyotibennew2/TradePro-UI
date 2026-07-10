import os
base = os.path.expanduser("~/tradepro-ui/src")

# --- Simulator.tsx patch ---
sim = os.path.join(base, "pages/Simulator.tsx")
txt = open(sim).read()

if "IronCondorBuilder" not in txt:
    txt = txt.replace(
        'import Card                  from "../components/ui/Card";',
        'import Card                  from "../components/ui/Card";\nimport IronCondorBuilder from "../simulator/components/IronCondorBuilder";'
    )
    txt = txt.replace(
        "    } catch { clearLegs(); }\n  };",
        "    } catch { clearLegs(); }\n  };\n\n  const handleBuildIronCondor = (opts: {callInner:number;callWing:number;putInner:number;putWing:number}) => {\n    const built = StrategyBuilder.build('IRON_CONDOR' as any, underlying, effectiveSpot, daysToExpiry, iv, riskFreeRate, 1, '', opts);\n    clearLegs(); built.forEach(leg => addLeg(leg));\n  };",
        1
    )
    txt = txt.replace(
        '<StrategyTemplates onSelect={handleTemplate} selected={template} />\n            </Card>\n\n            <Card title="Add Legs">',
        '<StrategyTemplates onSelect={handleTemplate} selected={template} />\n            </Card>\n\n            {template === "IRON_CONDOR" && (\n              <Card title="🦅 Iron Condor Builder"><IronCondorBuilder underlying={underlying} spot={effectiveSpot} iv={iv} daysToExpiry={daysToExpiry} r={riskFreeRate} lots={1} onBuild={handleBuildIronCondor} /></Card>\n            )}\n\n            <Card title="Add Legs">'
    )
    open(sim, "w").write(txt)
    print("✅ Simulator.tsx updated")
else:
    print("ℹ️  Simulator.tsx already updated")

# --- strategyBuilder.ts patch ---
sb = os.path.join(base, "simulator/services/strategyBuilder.ts")
txt2 = open(sb).read()
if "callInner" not in txt2:
    txt2 = txt2.replace(
        "static build(\n    type       : StrategyType,",
        "static build(\n    type       : StrategyType | string,"
    )
    txt2 = txt2.replace(
        "    lots        : number = 1,\n    expiry      : string = \"\",\n  ): OptionLeg[] {",
        "    lots        : number = 1,\n    expiry      : string = \"\",\n    opts: {callInner?:number;callWing?:number;putInner?:number;putWing?:number} = {}\n  ): OptionLeg[] {\n    const {callInner=2,callWing=2,putInner=2,putWing=2} = opts;"
    )
    txt2 = txt2.replace(
        "      leg(A + step * 2, \"CE\", \"SELL\"),  // Short call\n          leg(A + step * 4, \"CE\", \"BUY\"),   // Long call",
        "      leg(A + step * callInner,              \"CE\", \"SELL\"),\n          leg(A + step * (callInner + callWing), \"CE\", \"BUY\"),"
    )
    txt2 = txt2.replace(
        "      leg(A - step * 2, \"PE\", \"SELL\"),  // Short put\n          leg(A - step * 4, \"PE\", \"BUY\"),   // Long put",
        "      leg(A - step * putInner,               \"PE\", \"SELL\"),\n          leg(A - step * (putInner + putWing),   \"PE\", \"BUY\"),"
    )
    open(sb, "w").write(txt2)
    print("✅ strategyBuilder.ts updated")
else:
    print("ℹ️  strategyBuilder.ts already updated")

print("Done! Run: npm run dev")
