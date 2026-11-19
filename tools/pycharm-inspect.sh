#!/bin/sh
# Runs PyCharm's code inspections on the Python pipeline without opening the IDE
# window, using the shared profile in .idea/inspectionProfiles/Project_Default.xml.
#
#   tools/pycharm-inspect.sh            then   python3 tools/inspections_summary.py
#
# It uses its own settings folder (so it also works while PyCharm is open) and
# registers the local python3 as the project interpreter ("Python 3", see .idea/misc.xml).
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
pycharm=${PYCHARM_APP:-"$HOME/Applications/PyCharm.app"}
work=${TMPDIR:-/tmp}/fearless-ledger-inspect
python=$(python3 -c 'import sys; print(sys.executable)')
stdlib=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["stdlib"])')

rm -rf "$work" "$here/inspections"
mkdir -p "$work/config/options" "$work/system"
cat > "$work/config/options/jdk.table.xml" <<EOF
<application>
  <component name="ProjectJdkTable">
    <jdk version="2">
      <name value="Python 3" />
      <type value="Python SDK" />
      <homePath value="$python" />
      <roots>
        <classPath><root type="composite"><root url="file://$stdlib" type="simple" /><root url="file://$stdlib/lib-dynload" type="simple" /></root></classPath>
        <sourcePath><root type="composite" /></sourcePath>
      </roots>
      <additional />
    </jdk>
  </component>
</application>
EOF
cat > "$work/idea.properties" <<EOF
idea.config.path=$work/config
idea.system.path=$work/system
idea.log.path=$work/log
EOF
PYCHARM_PROPERTIES="$work/idea.properties" "$pycharm/Contents/bin/inspect.sh" "$here" "$here/.idea/inspectionProfiles/Project_Default.xml" "$here/inspections" -v1 -format json -d "$here/pipeline"
echo "inspections written to $here/inspections"
