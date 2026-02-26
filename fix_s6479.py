#!/usr/bin/env python3
"""
Fix SonarCloud S6479: Array index used as key in React.

Strategies:
1. Array.from({length:N}).map((_, i) => ... key={`x-${i}`})
   → [...Array(N).keys()].map((i) => ... key={`x-${i}`})
   (i becomes a VALUE, not an index param)

2. primitiveArray.map((val, i) => ... key={`x-${i}`})
   → primitiveArray.map((val, i) => ... key={`x-${val}`})
   (use the actual value in the key, keep i for position math)
   OR → primitiveArray.map((val) => ... key={`x-${val}`})
   (remove i if not needed elsewhere)
"""

import re
from pathlib import Path

REPO = Path("/Users/ekinbot/ekinapps/crewhub")


def fix_array_from_length(content: str) -> str:
    """Convert Array.from({length:N}).map((_, i) =>) to [...Array(N).keys()].map((i) =>)"""
    # Match Array.from({ length: N }).map((anyVar, indexVar) =>
    p = re.compile(
        r'Array\.from\(\{\s*length:\s*(\d+)\s*\}\)\.map\(\([_a-zA-Z][_a-zA-Z0-9]*,\s*([a-zA-Z_][a-zA-Z0-9_]*)\)\s*=>'
    )
    def repl(m):
        n = m.group(1)
        idx = m.group(2)
        return f'[...Array({n}).keys()].map(({idx}) =>'
    return p.sub(repl, content)


def is_item_object(item_var: str, lines: list, map_line: int, end_line: int) -> bool:
    """
    Detect if item_var is used as an object (has property accesses like item_var.xxx).
    If so, we can't use ${item_var} directly in a key (would give [object Object]).
    """
    # Check the code block from map_line to end_line (max 50 lines)
    check_end = min(end_line, map_line + 50, len(lines))
    snippet = '\n'.join(lines[map_line:check_end])
    # If item_var appears followed by a dot (property access), it's an object
    obj_pattern = re.compile(r'\b' + re.escape(item_var) + r'\.[a-zA-Z_]')
    return bool(obj_pattern.search(snippet))


def has_scope_boundary(lines: list, from_line: int, to_line: int, idx_var: str) -> bool:
    """
    Detect if there's a new scope between from_line and to_line that would
    make the idx_var context from from_line irrelevant for to_line.
    
    Specifically: if there's an Array.from or another .map((_, idx_var) pattern
    between from_line and to_line, that inner map "owns" the idx_var.
    """
    # Check if there's an Array.from({length: N}).map((_, idx_var) or similar
    # between the outer map line and the key line
    for lineno in range(from_line + 1, min(to_line + 1, len(lines))):
        line = lines[lineno]
        # Check for a .map( call that uses idx_var as its second parameter
        # This means idx_var is owned by a closer .map(), not the outer one
        inner_map = re.compile(
            r'\.map\(\(([_a-zA-Z][_a-zA-Z0-9]*),\s*' + re.escape(idx_var) + r'\)\s*=>'
        )
        if inner_map.search(line):
            return True  # idx_var belongs to an inner map
        # Also check for function declarations that create a new scope
        if re.search(r'\bfunction\s+[A-Za-z]', line) and lineno > from_line + 1:
            return True
    return False


def fix_primitive_map_index_key(content: str) -> str:
    """
    For .map((val, i) => ... key={`prefix-${i}`} ...) patterns:
    replace the index var in the key with the value var.
    
    Only applies when:
    - val is NOT underscore (i.e., it's a meaningful name)
    - val is NOT used as an object (no val.property access in the block)
    """
    lines = content.split('\n')
    
    # Find all .map((itemVar, idxVar) => occurrences with line numbers
    map_pattern = re.compile(
        r'\.map\(\(([a-zA-Z_][a-zA-Z0-9_]*),\s*([a-zA-Z_][a-zA-Z0-9_]*)\)\s*=>'
    )
    
    # Build list of (linenum, item_var, idx_var) for maps where item_var != '_'
    map_contexts = []
    for lineno, line in enumerate(lines):
        for m in map_pattern.finditer(line):
            item_var = m.group(1)
            idx_var = m.group(2)
            if item_var != '_':  # Only when item is named (not placeholder)
                map_contexts.append((lineno, item_var, idx_var))
    
    new_lines = list(lines)
    
    for lineno, line in enumerate(lines):
        if 'key=' not in line:
            continue
        
        # Find the most recent map context within 60 lines
        active = [
            (ln, iv, idv) for ln, iv, idv in map_contexts
            if ln <= lineno and lineno - ln <= 60
        ]
        if not active:
            continue
        
        map_lineno, item_var, idx_var = active[-1]
        
        # Skip if item_var is used as an object (would give [object Object])
        if is_item_object(item_var, lines, map_lineno, lineno + 10):
            continue
        
        # Skip if there's an inner scope between map context and this key
        # that "owns" the idx_var (e.g., an Array.from or nested .map)
        if has_scope_boundary(lines, map_lineno, lineno, idx_var):
            continue
        
        # Pattern A: key={`something-${idxVar}something`}
        # → key={`something-${itemVar}something`}
        def replace_template_key(m):
            full = m.group(0)
            inner = m.group(1)  # content inside backticks
            # Check if idx_var appears in the inner template
            if '${' + idx_var + '}' in inner:
                new_inner = inner.replace('${' + idx_var + '}', '${' + item_var + '}')
                return 'key={`' + new_inner + '`}'
            return full
        
        tpl_key_pattern = re.compile(r'key=\{`([^`]+)`\}')
        new_line = tpl_key_pattern.sub(replace_template_key, line)
        
        # Pattern B: key={idxVar} (simple, no template)
        # → key={`${itemVar}`}
        def replace_simple_key(m):
            var = m.group(1)
            if var == idx_var and item_var not in ('_',):
                # Use item_var as the key (it's a primitive, safe to stringify)
                return 'key={`${' + item_var + '}`}'
            return m.group(0)
        
        simple_key_re = re.compile(r'key=\{([a-zA-Z_][a-zA-Z0-9_]*)\}')
        new_line = simple_key_re.sub(replace_simple_key, new_line)
        
        if new_line != line:
            new_lines[lineno] = new_line
    
    return '\n'.join(new_lines)


def fix_file(filepath: str) -> tuple[bool, list[str]]:
    full_path = REPO / filepath
    if not full_path.exists():
        return False, [f"NOT FOUND: {filepath}"]
    
    with open(full_path, 'r', encoding='utf-8') as f:
        original = f.read()
    
    content = original
    content = fix_array_from_length(content)
    content = fix_primitive_map_index_key(content)
    
    if content != original:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        # Count changes
        orig_lines = original.split('\n')
        new_lines = content.split('\n')
        changes = [f"  L{i+1}: {ol!r}" for i, (ol, nl) in 
                   enumerate(zip(orig_lines, new_lines)) if ol != nl]
        return True, changes
    
    return False, []


ISSUE_FILES = """frontend/src/components/world3d/RoomProps.tsx
frontend/src/components/world3d/grid/props/propComponents.tsx
frontend/src/components/chat/ChatMessageBubble.tsx
frontend/src/components/world3d/zones/creator/PropControls.tsx
frontend/src/components/zen/ZenActivityDetailPanel.tsx
frontend/src/components/mobile/ActiveTasksOverlay.tsx
rnd/hq-redesign/src/designs/TheRing.tsx
frontend/src/components/zen/FullscreenDetailView.tsx
frontend/src/components/world3d/props/Bench.tsx
rnd/hq-redesign/src/Props.tsx
frontend/src/components/world3d/props/showcase/Whiteboard.tsx
frontend/src/components/zen/ZenSessionDetailPanel.tsx
frontend/src/components/onboarding/steps/StepScan.tsx
frontend/src/components/world3d/props/showcase/creative/CuttingMat.tsx
frontend/src/components/world3d/props/showcase/gaming/ConsoleStand.tsx
frontend/src/components/world3d/props/showcase/gaming/PopFigure.tsx
frontend/src/components/world3d/props/showcase/office/Bookshelf.tsx
frontend/src/components/world3d/props/showcase/tech/FPGABoard.tsx
frontend/src/components/world3d/props/showcase/tech/LogicAnalyzer.tsx
frontend/src/components/world3d/props/showcase/tech/NetworkSwitch.tsx
frontend/src/components/world3d/props/showcase/gaming/GameController.tsx
frontend/src/components/world3d/props/showcase/tech/CircuitBoard.tsx
rnd/prop-creator-showcase/src/props/gaming/GameController.tsx
rnd/prop-creator-showcase/src/props/tech/CircuitBoard.tsx
frontend/src/components/world3d/grid/props/propAnimations.tsx
frontend/src/components/world3d/environments/IslandEnvironment.tsx
frontend/src/components/world3d/props/showcase/creative/WatercolorSet.tsx
frontend/src/components/world3d/props/showcase/tech/CableTester.tsx
frontend/src/components/world3d/zones/creator/GenerationHistory.tsx
frontend/src/components/zen/ZenTooltip.tsx
frontend/src/components/meetings/MeetingProgressView.tsx
frontend/src/components/sessions/LogViewer.tsx
frontend/src/components/world3d/props/showcase/DataCrystal.tsx
frontend/src/components/world3d/props/showcase/general/BulletinBoard.tsx
frontend/src/components/world3d/props/showcase/science/PipetteStand.tsx
frontend/src/components/world3d/zones/creator/DynamicProp.tsx
rnd/hq-redesign/src/designs/ThePavilions.tsx
frontend/src/components/world3d/props/showcase/gaming/Figurine.tsx
frontend/src/components/world3d/props/showcase/tech/VRHeadset.tsx
rnd/prop-creator-showcase/src/props/gaming/Figurine.tsx
rnd/prop-creator-showcase/src/props/office/Bookshelf.tsx
rnd/prop-creator-showcase/src/props/tech/VRHeadset.tsx
frontend/src/components/onboarding/OpenClawWizard.tsx
frontend/src/components/world3d/props/showcase/gaming/GamingKeyboard.tsx
frontend/src/components/world3d/props/showcase/office/DeskPhone.tsx
frontend/src/components/world3d/props/showcase/office/ScientificCalculator.tsx
frontend/src/components/world3d/props/showcase/workshop/SocketWrenchSet.tsx
frontend/src/components/mobile/MobileCreatorView.tsx
frontend/src/components/zen/ZenErrorBoundary.tsx
frontend/src/components/world3d/ProjectDocsPanel.tsx
frontend/src/components/world3d/props/showcase/CoffeeMachine.tsx
frontend/src/components/world3d/props/showcase/creative/ColorSwatches.tsx
frontend/src/components/world3d/props/showcase/creative/OilPastels.tsx
frontend/src/components/world3d/props/showcase/gaming/AmiiboFigure.tsx
frontend/src/components/world3d/props/showcase/gaming/ControllerGrip.tsx
frontend/src/components/world3d/props/showcase/gaming/EsportsTrophy.tsx
frontend/src/components/world3d/props/showcase/gaming/GamingChairFootrest.tsx
frontend/src/components/world3d/props/showcase/gaming/GreenScreen.tsx
frontend/src/components/world3d/props/showcase/office/BindingMachine.tsx
frontend/src/components/world3d/props/showcase/office/FlipchartStand.tsx
frontend/src/components/world3d/props/showcase/office/HolePuncher.tsx
frontend/src/components/world3d/props/showcase/office/LabelMaker.tsx
frontend/src/components/world3d/props/showcase/office/PaperClipsHolder.tsx
frontend/src/components/world3d/props/showcase/office/Projector.tsx
frontend/src/components/world3d/props/showcase/science/GraduatedCylinder.tsx
frontend/src/components/world3d/props/showcase/science/LabApron.tsx
frontend/src/components/world3d/props/showcase/science/SafetyShower.tsx
frontend/src/components/world3d/props/showcase/tech/LEDMatrixDisplay.tsx
frontend/src/components/world3d/props/showcase/tech/MicrocontrollerKit.tsx
frontend/src/components/world3d/props/showcase/tech/Modem.tsx
frontend/src/components/world3d/props/showcase/tech/Multimeter.tsx
frontend/src/components/world3d/props/showcase/tech/Oscilloscope.tsx
frontend/src/components/world3d/props/showcase/tech/ServoMotors.tsx
frontend/src/components/zen/ZenCommandPalette.tsx
rnd/hq-redesign/src/designs/TheAtrium.tsx
rnd/hq-redesign/src/designs/TheHelix.tsx
rnd/prop-creator-showcase/src/props/creative/CuttingMat.tsx
rnd/prop-creator-showcase/src/props/gaming/ConsoleStand.tsx
rnd/prop-creator-showcase/src/props/gaming/PopFigure.tsx
rnd/prop-creator-showcase/src/props/general/BulletinBoard.tsx
rnd/prop-creator-showcase/src/props/general/SpaceHeater.tsx
rnd/prop-creator-showcase/src/props/science/PipetteStand.tsx
rnd/prop-creator-showcase/src/props/tech/FPGABoard.tsx
rnd/prop-creator-showcase/src/props/tech/LogicAnalyzer.tsx
rnd/prop-creator-showcase/src/props/tech/NetworkSwitch.tsx
frontend/src/components/world3d/props/showcase/gaming/GamingChair.tsx
frontend/src/components/world3d/props/showcase/general/SpaceHeater.tsx
frontend/src/components/world3d/props/showcase/office/FilingCabinet.tsx
frontend/src/components/world3d/props/showcase/science/Microscope.tsx
frontend/src/components/world3d/props/showcase/science/MolecularModel.tsx
frontend/src/components/world3d/props/showcase/science/TestTubes.tsx
frontend/src/components/world3d/props/showcase/workshop/Toolbox.tsx
frontend/src/components/world3d/props/showcase/Globe.tsx
frontend/src/components/world3d/props/showcase/ServerRack.tsx
rnd/prop-creator-showcase/src/props/gaming/GamingChair.tsx
rnd/prop-creator-showcase/src/props/office/FilingCabinet.tsx
rnd/prop-creator-showcase/src/props/science/Microscope.tsx
rnd/prop-creator-showcase/src/props/science/MolecularModel.tsx
rnd/prop-creator-showcase/src/props/science/TestTubes.tsx
rnd/prop-creator-showcase/src/props/workshop/Toolbox.tsx
rnd/prop-creator-showcase/src/props/DataCrystal.tsx
rnd/prop-creator-showcase/src/props/Globe.tsx
rnd/prop-creator-showcase/src/props/ServerRack.tsx
rnd/prop-creator-showcase/src/props/Whiteboard.tsx
frontend/src/components/world3d/zones/creator/PropMakerRoom.tsx
frontend/src/components/zen/ZenKeyboardHelp.tsx
frontend/src/components/world3d/AgentChatPanel.tsx
frontend/src/components/world3d/grid/GridDebugOverlay.tsx
frontend/src/components/world3d/BotChestDisplay.tsx
frontend/src/components/world3d/zones/creator/ThinkingPanel.tsx
frontend/src/components/settings/DataTab.tsx
frontend/src/components/settings/ProjectsTab.tsx
frontend/src/components/mobile/MobileProjectsPanel.tsx
frontend/src/components/mobile/AgentScene3D.tsx
frontend/src/components/world3d/Hallway.tsx
frontend/src/components/meetings/MeetingOutput.tsx
rnd/hq-redesign/src/UI.tsx
rnd/prop-creator-showcase/src/props/creative/ColorSwatches.tsx
rnd/prop-creator-showcase/src/props/creative/InkBottles.tsx
rnd/prop-creator-showcase/src/props/creative/OilPastels.tsx
rnd/prop-creator-showcase/src/props/creative/WatercolorSet.tsx
rnd/prop-creator-showcase/src/props/gaming/AmiiboFigure.tsx
rnd/prop-creator-showcase/src/props/gaming/CableSleeve.tsx
rnd/prop-creator-showcase/src/props/gaming/ControllerGrip.tsx
rnd/prop-creator-showcase/src/props/gaming/EsportsTrophy.tsx
rnd/prop-creator-showcase/src/props/gaming/GameCaseStorage.tsx
rnd/prop-creator-showcase/src/props/gaming/GamingChairFootrest.tsx
rnd/prop-creator-showcase/src/props/gaming/GamingKeyboard.tsx
rnd/prop-creator-showcase/src/props/gaming/GreenScreen.tsx
rnd/prop-creator-showcase/src/props/gaming/ThumbstickCaps.tsx
rnd/prop-creator-showcase/src/props/general/CableClips.tsx
rnd/prop-creator-showcase/src/props/general/DeskOrganizerTray.tsx
rnd/prop-creator-showcase/src/props/general/MiniFridge.tsx
rnd/prop-creator-showcase/src/props/general/Nameplate.tsx
rnd/prop-creator-showcase/src/props/general/PaperShredder.tsx
rnd/prop-creator-showcase/src/props/general/TissueBox.tsx
rnd/prop-creator-showcase/src/props/general/USBHub.tsx
rnd/prop-creator-showcase/src/props/general/WhiteboardMarkers.tsx
rnd/prop-creator-showcase/src/props/office/BindingMachine.tsx
rnd/prop-creator-showcase/src/props/office/DeskPhone.tsx
rnd/prop-creator-showcase/src/props/office/DocumentTray.tsx
rnd/prop-creator-showcase/src/props/office/FlipchartStand.tsx
rnd/prop-creator-showcase/src/props/office/HolePuncher.tsx
rnd/prop-creator-showcase/src/props/office/LabelMaker.tsx
rnd/prop-creator-showcase/src/props/office/PaperClipsHolder.tsx
rnd/prop-creator-showcase/src/props/office/Projector.tsx
rnd/prop-creator-showcase/src/props/office/RubberStamps.tsx
rnd/prop-creator-showcase/src/props/office/ScientificCalculator.tsx
rnd/prop-creator-showcase/src/props/science/CoverSlips.tsx
rnd/prop-creator-showcase/src/props/science/GraduatedCylinder.tsx
rnd/prop-creator-showcase/src/props/science/LabApron.tsx
rnd/prop-creator-showcase/src/props/science/LitmusPaper.tsx
rnd/prop-creator-showcase/src/props/science/SafetyShower.tsx
rnd/prop-creator-showcase/src/props/tech/CableTester.tsx
rnd/prop-creator-showcase/src/props/tech/LEDMatrixDisplay.tsx
rnd/prop-creator-showcase/src/props/tech/MicrocontrollerKit.tsx
rnd/prop-creator-showcase/src/props/tech/Modem.tsx
rnd/prop-creator-showcase/src/props/tech/Multimeter.tsx
rnd/prop-creator-showcase/src/props/tech/Oscilloscope.tsx
rnd/prop-creator-showcase/src/props/tech/ServoMotors.tsx
rnd/prop-creator-showcase/src/props/workshop/SocketWrenchSet.tsx
frontend/src/components/world3d/props/showcase/creative/ColorWheel.tsx
frontend/src/components/world3d/props/showcase/creative/Easel.tsx
frontend/src/components/world3d/props/showcase/creative/InkBottles.tsx
frontend/src/components/world3d/props/showcase/creative/PaintPalette.tsx
frontend/src/components/world3d/props/showcase/creative/StickyNotes.tsx
frontend/src/components/world3d/props/showcase/gaming/CableSleeve.tsx
frontend/src/components/world3d/props/showcase/gaming/GameCaseStorage.tsx
frontend/src/components/world3d/props/showcase/gaming/HeadsetStand.tsx
frontend/src/components/world3d/props/showcase/gaming/Poster.tsx
frontend/src/components/world3d/props/showcase/gaming/ThumbstickCaps.tsx
frontend/src/components/world3d/props/showcase/general/CableClips.tsx
frontend/src/components/world3d/props/showcase/general/DeskOrganizerTray.tsx
frontend/src/components/world3d/props/showcase/general/MiniFridge.tsx
frontend/src/components/world3d/props/showcase/general/Nameplate.tsx
frontend/src/components/world3d/props/showcase/general/PaperShredder.tsx
frontend/src/components/world3d/props/showcase/general/TissueBox.tsx
frontend/src/components/world3d/props/showcase/general/USBHub.tsx
frontend/src/components/world3d/props/showcase/general/WhiteboardMarkers.tsx
frontend/src/components/world3d/props/showcase/office/CoffeeMug.tsx
frontend/src/components/world3d/props/showcase/office/DocumentTray.tsx
frontend/src/components/world3d/props/showcase/office/Monitor.tsx
frontend/src/components/world3d/props/showcase/office/RubberStamps.tsx
frontend/src/components/world3d/props/showcase/science/CoverSlips.tsx
frontend/src/components/world3d/props/showcase/science/LitmusPaper.tsx
frontend/src/components/world3d/props/showcase/science/PetriDish.tsx
frontend/src/components/world3d/props/showcase/science/SafetyGoggles.tsx
frontend/src/components/world3d/props/showcase/tech/PowerStrip.tsx
frontend/src/components/world3d/props/showcase/tech/Router.tsx
frontend/src/components/world3d/props/showcase/workshop/Workbench.tsx
frontend/src/components/world3d/props/components/DataStream.tsx
frontend/src/components/world3d/props/components/SteamParticles.tsx
frontend/src/components/world3d/props/showcase/CodeTerminal.tsx
frontend/src/components/world3d/props/showcase/Hourglass.tsx
frontend/src/components/world3d/props/showcase/Plant.tsx
rnd/prop-creator-showcase/src/props/creative/ColorWheel.tsx
rnd/prop-creator-showcase/src/props/creative/Easel.tsx
rnd/prop-creator-showcase/src/props/creative/PaintPalette.tsx
rnd/prop-creator-showcase/src/props/creative/StickyNotes.tsx
rnd/prop-creator-showcase/src/props/gaming/HeadsetStand.tsx
rnd/prop-creator-showcase/src/props/gaming/Poster.tsx
rnd/prop-creator-showcase/src/props/office/CoffeeMug.tsx
rnd/prop-creator-showcase/src/props/office/Monitor.tsx
rnd/prop-creator-showcase/src/props/science/PetriDish.tsx
rnd/prop-creator-showcase/src/props/science/SafetyGoggles.tsx
rnd/prop-creator-showcase/src/props/tech/PowerStrip.tsx
rnd/prop-creator-showcase/src/props/tech/Router.tsx
rnd/prop-creator-showcase/src/props/workshop/Workbench.tsx
rnd/prop-creator-showcase/src/props/CodeTerminal.tsx
rnd/prop-creator-showcase/src/props/CoffeeMachine.tsx
rnd/prop-creator-showcase/src/props/Hourglass.tsx
rnd/prop-creator-showcase/src/props/Plant.tsx
frontend/src/components/zen/ZenDocumentsPanel.tsx
frontend/src/components/world3d/zones/creator/PropMakerMachine.tsx
frontend/src/components/world3d/ZoneLandingView.tsx
frontend/src/components/world3d/ContextInspector.tsx
frontend/src/components/world3d/environments/DesertEnvironment.tsx
frontend/src/components/world3d/environments/FloatingEnvironment.tsx
frontend/src/components/world3d/BotAccessory.tsx
frontend/src/components/world3d/props/NoticeBoard.tsx
frontend/src/components/world3d/BuildingWalls.tsx
frontend/src/components/world3d/props/Desk.tsx
frontend/src/components/dev/DesignLab3D.tsx
frontend/src/components/sessions/SessionCard.tsx""".strip().split('\n')


if __name__ == "__main__":
    import sys
    verbose = '-v' in sys.argv
    
    unique_files = list(dict.fromkeys(ISSUE_FILES))
    changed_files = []
    skipped = []
    
    for filepath in unique_files:
        changed, details = fix_file(filepath)
        if changed:
            changed_files.append(filepath)
            print(f"FIXED: {filepath}")
            if verbose:
                for d in details[:5]:
                    print(d)
        else:
            skipped.append(filepath)
            if verbose:
                print(f"skip: {filepath}")
    
    print(f"\n{'='*60}")
    print(f"Fixed: {len(changed_files)} files")
    print(f"Skipped: {len(skipped)} files (may need manual review)")
