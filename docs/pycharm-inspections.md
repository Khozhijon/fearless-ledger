# PyCharm code inspections

Produced with `tools/pycharm-inspect.sh` (PyCharm 2026.3's headless inspector, profile `.idea/inspectionProfiles/Project_Default.xml`) over `pipeline/`, summarised with `tools/inspections_summary.py`.

## First run, 19 Nov 2026 (35 findings)

```
GrazieInspection: 3
  pipeline/ledger/geo.py:4  This word is normally spelled with a hyphen.
  pipeline/ledger/extract.py:19  This word is normally spelled with a hyphen.
  pipeline/ledger/extract.py:188  Two consecutive dots
GrazieStyle: 2
  pipeline/ledger/aggregate.py:6  American English uses 'license'
  pipeline/ledger/pack.py:7  American English uses 'license'
PyShadowingNamesInspection: 4
  pipeline/ledger/aggregate.py:173  Shadows name 'c' from outer scope
  pipeline/ledger/aggregate.py:205  Shadows name 'c' from outer scope
  pipeline/ledger/build.py:54  Shadows name 'main' from outer scope
  pipeline/tests/synthetic.py:87  Shadows name 'clock' from outer scope
PyStringFormatInspection: 1
  pipeline/ledger/pack.py:72  Format spec is not supported for 'UnsafeUnion[float | int, Unknown]' ('object.__format__' only accepts empty string)
PyTypeCheckerInspection: 17
  pipeline/ledger/aggregate.py:135  '+=' is not supported between 'list[Unknown]' and 'Literal[1]'
  pipeline/ledger/aggregate.py:137  '+=' is not supported between 'list[Unknown]' and 'Literal[1]'
  pipeline/ledger/aggregate.py:145  '+=' is not supported between 'Counter[Unknown]' and 'Literal[1]'
  pipeline/ledger/aggregate.py:221  No overload of 'sum' matches the arguments. Argument types: (int | list[Unknown]). Expected one of: (iterable: Iterable[
  pipeline/ledger/aggregate.py:221  Expected type 'Sized', got 'int | list[Unknown]' instead
  pipeline/ledger/aggregate.py:226  Expected type 'Counter[Unknown]', got 'int | Counter[Unknown]' instead
  pipeline/ledger/aggregate.py:227  Expected type 'Counter[Unknown]', got 'int | Counter[Unknown]' instead
  pipeline/ledger/aggregate.py:227  Expected type 'Counter[Unknown]', got 'int | Counter[Unknown]' instead
  pipeline/ledger/aggregate.py:227  Expected type 'Counter[Unknown]', got 'int | Counter[Unknown]' instead
  pipeline/ledger/aggregate.py:237  Expected type 'dict[str, list[dict[Unknown, Unknown]]]', got 'dict[str | SupportsDunderLT[Any] | SupportsDunderGT[Any], 
  pipeline/tests/synthetic.py:25  Expected type 'str | dict[str, float | int] | float | int', got 'dict[Literal["name"], str]' instead
  pipeline/tests/synthetic.py:52  No overload of 'update' matches the arguments. Argument types: (finished=Literal[True], titleVersion=dict[Literal["name"
  pipeline/ledger/extract.py:100  Expected type 'str', got 'Unknown | None' instead
  pipeline/ledger/extract.py:131  Expected type 'str', got 'Unknown | None' instead
  pipeline/ledger/extract.py:131  No overload of 'get' matches the arguments. Argument types: (Unknown | None, Literal[0]). Expected one of: (key: str, de
  pipeline/ledger/extract.py:145  'in' is not supported between 'Literal["x"]' and 'Unknown | None'
  pipeline/ledger/pack.py:65  Expected type 'list[str]', got 'list[SupportsDunderLT[Any] | SupportsDunderGT[Any]] | list[str]' instead
PyUnresolvedReferencesInspection: 8
  pipeline/ledger/aggregate.py:138  Member 'int' of 'int | list[Unknown]' does not have attribute 'append'
  pipeline/ledger/aggregate.py:148  Member 'int' of 'int | Counter[Unknown]' does not have attribute '__getitem__'
  pipeline/ledger/aggregate.py:151  Member 'int' of 'int | Counter[Unknown]' does not have attribute '__getitem__'
  pipeline/ledger/aggregate.py:153  Member 'int' of 'int | Counter[Unknown]' does not have attribute '__getitem__'
  pipeline/ledger/aggregate.py:156  Member 'int' of 'int | Counter[Unknown]' does not have attribute '__getitem__'
  pipeline/ledger/aggregate.py:159  Member 'int' of 'int | Counter[Unknown]' does not have attribute '__getitem__'
  pipeline/ledger/extract.py:145  Member 'None' of 'Unknown | None' does not have attribute '__getitem__'
  pipeline/ledger/extract.py:145  Member 'None' of 'Unknown | None' does not have attribute '__getitem__'
total: 35
```

## What was changed

- `aggregate.py`: the per-team tallies were dicts mixing ints, lists and Counters (`objectives[name]["t"].append`, `jungle["start"][...] += 1`), which the type checker could not follow (25 findings). They are now three small dataclasses: `ObjectiveTally`, `JungleTally`, `GameNumberTally`. Output checked identical before and after on the real data.
- `extract.py`: a kill's victim position could be `None` and was indexed (`vpos["x"]`); now it falls back to an empty dict and the zone is only computed when both coordinates exist. Event ids are checked to be strings before they become dictionary keys.
- `build.py`: a local dict named `main` shadowed the module's `main()` function; renamed `usual`.
- `aggregate.py`, `tests/synthetic.py`: loop variables shadowing outer names (`c`, `clock`) renamed.
- `pack.py`, `aggregate.py`: type annotations where inference gave up (`team_ids: list[str]`, `latest: str`).

## Last run (3 findings, all wording)

```
GrazieInspection: 1
  pipeline/ledger/geo.py:4  This word is normally spelled with a hyphen.
GrazieStyle: 2
  pipeline/ledger/pack.py:7  American English uses 'license'
  pipeline/ledger/aggregate.py:6  American English uses 'license'
total: 3
```

The three that remain are grammar suggestions kept on purpose: "licence" is the British spelling of the noun, and "mid lane" is used as a noun.
