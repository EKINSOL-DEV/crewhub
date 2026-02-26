import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

// General (original 10)
import { AIBrain } from './props/AIBrain';
import { DataCrystal } from './props/DataCrystal';
import { CodeTerminal } from './props/CodeTerminal';
import { CoffeeMachine } from './props/CoffeeMachine';
import { Whiteboard } from './props/Whiteboard';
import { Plant } from './props/Plant';
import { ServerRack } from './props/ServerRack';
import { Hourglass } from './props/Hourglass';
import { Globe } from './props/Globe';
import { Rocket } from './props/Rocket';

// Office & Productivity
import { DeskLamp } from './props/office/DeskLamp';
import { Monitor } from './props/office/Monitor';
import { Keyboard } from './props/office/Keyboard';
import { CoffeeMug } from './props/office/CoffeeMug';
import { Printer } from './props/office/Printer';
import { FilingCabinet } from './props/office/FilingCabinet';
import { Bookshelf } from './props/office/Bookshelf';
import { Stapler } from './props/office/Stapler';
import { DeskClock } from './props/office/DeskClock';
import { Headphones } from './props/office/Headphones';
import { WaterBottle } from './props/office/WaterBottle';

// Tech & Developer
import { RaspberryPi } from './props/tech/RaspberryPi';
import { Router } from './props/tech/Router';
import { USBDrive } from './props/tech/USBDrive';
import { MechKeyboard } from './props/tech/MechKeyboard';
import { HardDrive } from './props/tech/HardDrive';
import { VRHeadset } from './props/tech/VRHeadset';
import { CircuitBoard } from './props/tech/CircuitBoard';
import { MonitorStand } from './props/tech/MonitorStand';
import { PowerStrip } from './props/tech/PowerStrip';
import { SolderingIron } from './props/tech/SolderingIron';

// Creative & Art
import { Easel } from './props/creative/Easel';
import { PaintPalette } from './props/creative/PaintPalette';
import { Camera } from './props/creative/Camera';
import { PenTablet } from './props/creative/PenTablet';
import { Sketchbook } from './props/creative/Sketchbook';
import { RingLight } from './props/creative/RingLight';
import { ColorWheel } from './props/creative/ColorWheel';
import { Scissors } from './props/creative/Scissors';
import { StickyNotes } from './props/creative/StickyNotes';
import { Tripod } from './props/creative/Tripod';

// Gaming & Entertainment
import { GameController } from './props/gaming/GameController';
import { GamingChair } from './props/gaming/GamingChair';
import { ArcadeStick } from './props/gaming/ArcadeStick';
import { Figurine } from './props/gaming/Figurine';
import { Dice } from './props/gaming/Dice';
import { RGBStrip } from './props/gaming/RGBStrip';
import { HeadsetStand } from './props/gaming/HeadsetStand';
import { EnergyDrink } from './props/gaming/EnergyDrink';
import { GamingMousePad } from './props/gaming/GamingMousePad';
import { Poster } from './props/gaming/Poster';

// Science & Lab
import { Microscope } from './props/science/Microscope';
import { TestTubes } from './props/science/TestTubes';
import { Beaker } from './props/science/Beaker';
import { BunsenBurner } from './props/science/BunsenBurner';
import { MolecularModel } from './props/science/MolecularModel';
import { Telescope } from './props/science/Telescope';
import { MagnifyingGlass } from './props/science/MagnifyingGlass';
import { SafetyGoggles } from './props/science/SafetyGoggles';
import { PetriDish } from './props/science/PetriDish';
import { Thermometer } from './props/science/Thermometer';

// Workshop & Tools
import { Hammer } from './props/workshop/Hammer';
import { Drill } from './props/workshop/Drill';
import { Toolbox } from './props/workshop/Toolbox';
import { MeasuringTape } from './props/workshop/MeasuringTape';
import { Wrench } from './props/workshop/Wrench';
import { PaintCan } from './props/workshop/PaintCan';
import { Workbench } from './props/workshop/Workbench';
import { SafetyHelmet } from './props/workshop/SafetyHelmet';
import { Screwdriver } from './props/workshop/Screwdriver';
import { WoodPlanks } from './props/workshop/WoodPlanks';

// General (new)
import { WhiteboardMarkers } from './props/general/WhiteboardMarkers';
import { BulletinBoard } from './props/general/BulletinBoard';
import { TrashCan } from './props/general/TrashCan';
import { PaperShredder } from './props/general/PaperShredder';
import { DeskFan } from './props/general/DeskFan';
import { AirPurifier } from './props/general/AirPurifier';
import { SpaceHeater } from './props/general/SpaceHeater';
import { DeskOrganizerTray } from './props/general/DeskOrganizerTray';
import { CableClips } from './props/general/CableClips';
import { PictureFrame } from './props/general/PictureFrame';
import { PottedSucculent } from './props/general/PottedSucculent';
import { DeskMat } from './props/general/DeskMat';
import { Coaster } from './props/general/Coaster';
import { USBHub } from './props/general/USBHub';
import { WirelessCharger } from './props/general/WirelessCharger';
import { Nameplate } from './props/general/Nameplate';
import { TissueBox } from './props/general/TissueBox';
import { HandSanitizer } from './props/general/HandSanitizer';
import { DeskMirror } from './props/general/DeskMirror';
import { MiniFridge } from './props/general/MiniFridge';

// Office (new)
import { HolePuncher } from './props/office/HolePuncher';
import { LabelMaker } from './props/office/LabelMaker';
import { PaperClipsHolder } from './props/office/PaperClipsHolder';
import { RubberStamps } from './props/office/RubberStamps';
import { StickyNoteDispenser } from './props/office/StickyNoteDispenser';
import { BusinessCardHolder } from './props/office/BusinessCardHolder';
import { DocumentTray } from './props/office/DocumentTray';
import { ScientificCalculator } from './props/office/ScientificCalculator';
import { EnvelopeOpener } from './props/office/EnvelopeOpener';
import { MagnifyingLamp } from './props/office/MagnifyingLamp';
import { DeskPhone } from './props/office/DeskPhone';
import { ConferenceSpeakerphone } from './props/office/ConferenceSpeakerphone';
import { Projector } from './props/office/Projector';
import { PresentationPointer } from './props/office/PresentationPointer';
import { FlipchartStand } from './props/office/FlipchartStand';
import { BadgeHolder } from './props/office/BadgeHolder';
import { TimeClock } from './props/office/TimeClock';
import { PaperTrimmer } from './props/office/PaperTrimmer';
import { BindingMachine } from './props/office/BindingMachine';
import { Laminator } from './props/office/Laminator';

// Tech (new)
import { EthernetCableSpool } from './props/tech/EthernetCableSpool';
import { NetworkSwitch } from './props/tech/NetworkSwitch';
import { Modem } from './props/tech/Modem';
import { WiFiExtender } from './props/tech/WiFiExtender';
import { BluetoothSpeaker } from './props/tech/BluetoothSpeaker';
import { SDCardReader } from './props/tech/SDCardReader';
import { ExternalSSD } from './props/tech/ExternalSSD';
import { NASDrive } from './props/tech/NASDrive';
import { BackupBattery } from './props/tech/BackupBattery';
import { CoolingFan } from './props/tech/CoolingFan';
import { ThermalPasteTube } from './props/tech/ThermalPasteTube';
import { AntiStaticWristStrap } from './props/tech/AntiStaticWristStrap';
import { CableTester } from './props/tech/CableTester';
import { Multimeter } from './props/tech/Multimeter';
import { Oscilloscope } from './props/tech/Oscilloscope';
import { LogicAnalyzer } from './props/tech/LogicAnalyzer';
import { FPGABoard } from './props/tech/FPGABoard';
import { MicrocontrollerKit } from './props/tech/MicrocontrollerKit';
import { LEDMatrixDisplay } from './props/tech/LEDMatrixDisplay';
import { ServoMotors } from './props/tech/ServoMotors';

// Creative (new)
import { SprayPaintCan } from './props/creative/SprayPaintCan';
import { AirbrushKit } from './props/creative/AirbrushKit';
import { CharcoalSticks } from './props/creative/CharcoalSticks';
import { OilPastels } from './props/creative/OilPastels';
import { WatercolorSet } from './props/creative/WatercolorSet';
import { CanvasStretcher } from './props/creative/CanvasStretcher';
import { GessoJar } from './props/creative/GessoJar';
import { PaletteKnife } from './props/creative/PaletteKnife';
import { BrushCleanerJar } from './props/creative/BrushCleanerJar';
import { MaskingTape } from './props/creative/MaskingTape';
import { CuttingMat } from './props/creative/CuttingMat';
import { XActoKnife } from './props/creative/XActoKnife';
import { KneadedEraser } from './props/creative/KneadedEraser';
import { FixativeSpray } from './props/creative/FixativeSpray';
import { PortfolioCase } from './props/creative/PortfolioCase';
import { Lightbox } from './props/creative/Lightbox';
import { ColorSwatches } from './props/creative/ColorSwatches';
import { InkBottles } from './props/creative/InkBottles';
import { CalligraphyPens } from './props/creative/CalligraphyPens';
import { ClaySculptingTools } from './props/creative/ClaySculptingTools';

// Gaming (new)
import { GameCartridge } from './props/gaming/GameCartridge';
import { MemoryCard } from './props/gaming/MemoryCard';
import { ControllerGrip } from './props/gaming/ControllerGrip';
import { ThumbstickCaps } from './props/gaming/ThumbstickCaps';
import { GamingKeyboard } from './props/gaming/GamingKeyboard';
import { MouseBungee } from './props/gaming/MouseBungee';
import { WristRest } from './props/gaming/WristRest';
import { MonitorArm } from './props/gaming/MonitorArm';
import { CableSleeve } from './props/gaming/CableSleeve';
import { StreamingMicrophone } from './props/gaming/StreamingMicrophone';
import { GreenScreen } from './props/gaming/GreenScreen';
import { KeyLight } from './props/gaming/KeyLight';
import { CaptureCard } from './props/gaming/CaptureCard';
import { ConsoleStand } from './props/gaming/ConsoleStand';
import { GameCaseStorage } from './props/gaming/GameCaseStorage';
import { AmiiboFigure } from './props/gaming/AmiiboFigure';
import { PopFigure } from './props/gaming/PopFigure';
import { EsportsTrophy } from './props/gaming/EsportsTrophy';
import { LANCable } from './props/gaming/LANCable';
import { GamingChairFootrest } from './props/gaming/GamingChairFootrest';

// Science (new)
import { BunsenBurnerTripod } from './props/science/BunsenBurnerTripod';
import { CrucibleTongs } from './props/science/CrucibleTongs';
import { StirringRod } from './props/science/StirringRod';
import { DropperBottle } from './props/science/DropperBottle';
import { PipetteStand } from './props/science/PipetteStand';
import { LabNotebook } from './props/science/LabNotebook';
import { SafetyShower } from './props/science/SafetyShower';
import { FumeHoodModel } from './props/science/FumeHoodModel';
import { Autoclave } from './props/science/Autoclave';
import { Centrifuge } from './props/science/Centrifuge';
import { PHMeter } from './props/science/PHMeter';
import { LitmusPaper } from './props/science/LitmusPaper';
import { GraduatedCylinder } from './props/science/GraduatedCylinder';
import { ConicalFlask } from './props/science/ConicalFlask';
import { MortarAndPestle } from './props/science/MortarAndPestle';
import { LabTimer } from './props/science/LabTimer';
import { SpecimenJar } from './props/science/SpecimenJar';
import { MicroscopeSlides } from './props/science/MicroscopeSlides';
import { CoverSlips } from './props/science/CoverSlips';
import { LabApron } from './props/science/LabApron';

// Workshop (new)
import { ChiselSet } from './props/workshop/ChiselSet';
import { WoodPlane } from './props/workshop/WoodPlane';
import { CClamp } from './props/workshop/CClamp';
import { AngleGrinder } from './props/workshop/AngleGrinder';
import { Jigsaw } from './props/workshop/Jigsaw';
import { CircularSaw } from './props/workshop/CircularSaw';
import { WoodRouter } from './props/workshop/WoodRouter';
import { OrbitalSander } from './props/workshop/OrbitalSander';
import { NailGun } from './props/workshop/NailGun';
import { StapleGun } from './props/workshop/StapleGun';
import { WireCutters } from './props/workshop/WireCutters';
import { NeedleNosePliers } from './props/workshop/NeedleNosePliers';
import { AllenKeySet } from './props/workshop/AllenKeySet';
import { SocketWrenchSet } from './props/workshop/SocketWrenchSet';
import { TorqueWrench } from './props/workshop/TorqueWrench';
import { PipeWrench } from './props/workshop/PipeWrench';
import { AdjustableSpanner } from './props/workshop/AdjustableSpanner';
import { UtilityKnife } from './props/workshop/UtilityKnife';
import { LargeTapeMeasure } from './props/workshop/LargeTapeMeasure';
import { WorkLight } from './props/workshop/WorkLight';

interface PropDef {
  name: string;
  Component: React.FC;
  color: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  props: PropDef[];
}

const categories: Category[] = [
  {
    id: 'general', name: 'General', icon: '🎨',
    props: [
      { name: 'AI Brain', Component: AIBrain, color: '#00ffff' },
      { name: 'Data Crystal', Component: DataCrystal, color: '#aa44ff' },
      { name: 'Code Terminal', Component: CodeTerminal, color: '#66ff66' },
      { name: 'Coffee Machine', Component: CoffeeMachine, color: '#ff6644' },
      { name: 'Whiteboard', Component: Whiteboard, color: '#ffee44' },
      { name: 'Plant', Component: Plant, color: '#44dd66' },
      { name: 'Server Rack', Component: ServerRack, color: '#4488ff' },
      { name: 'Hourglass', Component: Hourglass, color: '#ffcc44' },
      { name: 'Globe', Component: Globe, color: '#44ddff' },
      { name: 'Rocket', Component: Rocket, color: '#ff4444' },
      { name: 'Whiteboard Markers', Component: WhiteboardMarkers, color: '#f0f0f0' },
      { name: 'Bulletin Board', Component: BulletinBoard, color: '#cc9955' },
      { name: 'Trash Can', Component: TrashCan, color: '#667788' },
      { name: 'Paper Shredder', Component: PaperShredder, color: '#ddddee' },
      { name: 'Desk Fan', Component: DeskFan, color: '#4488dd' },
      { name: 'Air Purifier', Component: AirPurifier, color: '#44ff88' },
      { name: 'Space Heater', Component: SpaceHeater, color: '#ff6644' },
      { name: 'Desk Organizer', Component: DeskOrganizerTray, color: '#ffcc44' },
      { name: 'Cable Clips', Component: CableClips, color: '#ff44ff' },
      { name: 'Picture Frame', Component: PictureFrame, color: '#aa7744' },
      { name: 'Potted Succulent', Component: PottedSucculent, color: '#66cc88' },
      { name: 'Desk Mat', Component: DeskMat, color: '#334466' },
      { name: 'Coaster', Component: Coaster, color: '#cc9955' },
      { name: 'USB Hub', Component: USBHub, color: '#44ff88' },
      { name: 'Wireless Charger', Component: WirelessCharger, color: '#44aaff' },
      { name: 'Nameplate', Component: Nameplate, color: '#cc9933' },
      { name: 'Tissue Box', Component: TissueBox, color: '#88ccff' },
      { name: 'Hand Sanitizer', Component: HandSanitizer, color: '#44ccff' },
      { name: 'Desk Mirror', Component: DeskMirror, color: '#cc9944' },
      { name: 'Mini Fridge', Component: MiniFridge, color: '#44ccff' },
    ],
  },
  {
    id: 'office', name: 'Office & Productivity', icon: '🏢',
    props: [
      { name: 'Desk Lamp', Component: DeskLamp, color: '#ffcc44' },
      { name: 'Monitor', Component: Monitor, color: '#4488ff' },
      { name: 'Keyboard', Component: Keyboard, color: '#ff44ff' },
      { name: 'Coffee Mug', Component: CoffeeMug, color: '#ff6644' },
      { name: 'Printer', Component: Printer, color: '#88dd88' },
      { name: 'Filing Cabinet', Component: FilingCabinet, color: '#7788aa' },
      { name: 'Bookshelf', Component: Bookshelf, color: '#aa8844' },
      { name: 'Stapler', Component: Stapler, color: '#ff2222' },
      { name: 'Desk Clock', Component: DeskClock, color: '#cc8833' },
      { name: 'Headphones', Component: Headphones, color: '#44ffaa' },
      { name: 'Water Bottle', Component: WaterBottle, color: '#4488dd' },
      { name: 'Hole Puncher', Component: HolePuncher, color: '#444455' },
      { name: 'Label Maker', Component: LabelMaker, color: '#4488dd' },
      { name: 'Paper Clips Holder', Component: PaperClipsHolder, color: '#ff44ff' },
      { name: 'Rubber Stamps', Component: RubberStamps, color: '#ff4444' },
      { name: 'Sticky Note Dispenser', Component: StickyNoteDispenser, color: '#ffee44' },
      { name: 'Business Card Holder', Component: BusinessCardHolder, color: '#333344' },
      { name: 'Document Tray', Component: DocumentTray, color: '#666677' },
      { name: 'Scientific Calculator', Component: ScientificCalculator, color: '#88bbaa' },
      { name: 'Envelope Opener', Component: EnvelopeOpener, color: '#ccbb88' },
      { name: 'Magnifying Lamp', Component: MagnifyingLamp, color: '#ffffcc' },
      { name: 'Desk Phone', Component: DeskPhone, color: '#44ccaa' },
      { name: 'Conference Speaker', Component: ConferenceSpeakerphone, color: '#44ff88' },
      { name: 'Projector', Component: Projector, color: '#ffffcc' },
      { name: 'Laser Pointer', Component: PresentationPointer, color: '#ff2222' },
      { name: 'Flipchart Stand', Component: FlipchartStand, color: '#ffffff' },
      { name: 'Badge Holder', Component: BadgeHolder, color: '#4488ff' },
      { name: 'Time Clock', Component: TimeClock, color: '#44cc44' },
      { name: 'Paper Trimmer', Component: PaperTrimmer, color: '#ccccdd' },
      { name: 'Binding Machine', Component: BindingMachine, color: '#555566' },
      { name: 'Laminator', Component: Laminator, color: '#44ff44' },
    ],
  },
  {
    id: 'tech', name: 'Tech & Developer', icon: '💻',
    props: [
      { name: 'Raspberry Pi', Component: RaspberryPi, color: '#228833' },
      { name: 'Router', Component: Router, color: '#44ff66' },
      { name: 'USB Drive', Component: USBDrive, color: '#4488ff' },
      { name: 'Mech Keyboard', Component: MechKeyboard, color: '#ff44ff' },
      { name: 'Hard Drive', Component: HardDrive, color: '#aaaacc' },
      { name: 'VR Headset', Component: VRHeadset, color: '#4488ff' },
      { name: 'Circuit Board', Component: CircuitBoard, color: '#44ff44' },
      { name: 'Monitor Stand', Component: MonitorStand, color: '#666688' },
      { name: 'Power Strip', Component: PowerStrip, color: '#ff4444' },
      { name: 'Soldering Iron', Component: SolderingIron, color: '#ff8844' },
      { name: 'Ethernet Spool', Component: EthernetCableSpool, color: '#4488ff' },
      { name: 'Network Switch', Component: NetworkSwitch, color: '#44ff44' },
      { name: 'Modem', Component: Modem, color: '#44ff44' },
      { name: 'WiFi Extender', Component: WiFiExtender, color: '#44aaff' },
      { name: 'BT Speaker', Component: BluetoothSpeaker, color: '#ff4488' },
      { name: 'SD Card Reader', Component: SDCardReader, color: '#44ff44' },
      { name: 'External SSD', Component: ExternalSSD, color: '#4488ff' },
      { name: 'NAS Drive', Component: NASDrive, color: '#44ff44' },
      { name: 'Backup Battery', Component: BackupBattery, color: '#4488ff' },
      { name: 'Cooling Fan', Component: CoolingFan, color: '#555577' },
      { name: 'Thermal Paste', Component: ThermalPasteTube, color: '#888899' },
      { name: 'ESD Strap', Component: AntiStaticWristStrap, color: '#4488ff' },
      { name: 'Cable Tester', Component: CableTester, color: '#ffcc44' },
      { name: 'Multimeter', Component: Multimeter, color: '#ffcc22' },
      { name: 'Oscilloscope', Component: Oscilloscope, color: '#44ff44' },
      { name: 'Logic Analyzer', Component: LogicAnalyzer, color: '#44ffaa' },
      { name: 'FPGA Board', Component: FPGABoard, color: '#225522' },
      { name: 'MCU Kit', Component: MicrocontrollerKit, color: '#ff4444' },
      { name: 'LED Matrix', Component: LEDMatrixDisplay, color: '#ff2222' },
      { name: 'Servo Motors', Component: ServoMotors, color: '#4488ff' },
    ],
  },
  {
    id: 'creative', name: 'Creative & Art', icon: '🎭',
    props: [
      { name: 'Easel', Component: Easel, color: '#ff4466' },
      { name: 'Paint Palette', Component: PaintPalette, color: '#ff8833' },
      { name: 'Camera', Component: Camera, color: '#444466' },
      { name: 'Pen Tablet', Component: PenTablet, color: '#4488ff' },
      { name: 'Sketchbook', Component: Sketchbook, color: '#884422' },
      { name: 'Ring Light', Component: RingLight, color: '#ffffaa' },
      { name: 'Color Wheel', Component: ColorWheel, color: '#ff00ff' },
      { name: 'Scissors', Component: Scissors, color: '#ff4444' },
      { name: 'Sticky Notes', Component: StickyNotes, color: '#ffee44' },
      { name: 'Tripod', Component: Tripod, color: '#666688' },
      { name: 'Spray Paint', Component: SprayPaintCan, color: '#ff4488' },
      { name: 'Airbrush', Component: AirbrushKit, color: '#aaaacc' },
      { name: 'Charcoal Sticks', Component: CharcoalSticks, color: '#222222' },
      { name: 'Oil Pastels', Component: OilPastels, color: '#ff8833' },
      { name: 'Watercolor Set', Component: WatercolorSet, color: '#ff4444' },
      { name: 'Canvas Stretcher', Component: CanvasStretcher, color: '#aa8844' },
      { name: 'Gesso Jar', Component: GessoJar, color: '#4488ff' },
      { name: 'Palette Knife', Component: PaletteKnife, color: '#ccccdd' },
      { name: 'Brush Cleaner', Component: BrushCleanerJar, color: '#8899bb' },
      { name: 'Masking Tape', Component: MaskingTape, color: '#eedd88' },
      { name: 'Cutting Mat', Component: CuttingMat, color: '#228844' },
      { name: 'X-Acto Knife', Component: XActoKnife, color: '#ccccdd' },
      { name: 'Kneaded Eraser', Component: KneadedEraser, color: '#bbbbcc' },
      { name: 'Fixative Spray', Component: FixativeSpray, color: '#4488ff' },
      { name: 'Portfolio Case', Component: PortfolioCase, color: '#333355' },
      { name: 'Lightbox', Component: Lightbox, color: '#ffffff' },
      { name: 'Color Swatches', Component: ColorSwatches, color: '#ff44aa' },
      { name: 'Ink Bottles', Component: InkBottles, color: '#ff2244' },
      { name: 'Calligraphy Pens', Component: CalligraphyPens, color: '#884422' },
      { name: 'Clay Tools', Component: ClaySculptingTools, color: '#bb9966' },
    ],
  },
  {
    id: 'gaming', name: 'Gaming & Entertainment', icon: '🎮',
    props: [
      { name: 'Game Controller', Component: GameController, color: '#4488ff' },
      { name: 'Gaming Chair', Component: GamingChair, color: '#ff2244' },
      { name: 'Arcade Stick', Component: ArcadeStick, color: '#ff4444' },
      { name: 'Figurine', Component: Figurine, color: '#ff4444' },
      { name: 'Dice', Component: Dice, color: '#4488ff' },
      { name: 'RGB Strip', Component: RGBStrip, color: '#ff00ff' },
      { name: 'Headset Stand', Component: HeadsetStand, color: '#ff44ff' },
      { name: 'Energy Drink', Component: EnergyDrink, color: '#44ff44' },
      { name: 'Gaming Mouse Pad', Component: GamingMousePad, color: '#ff00ff' },
      { name: 'Poster', Component: Poster, color: '#ff4444' },
      { name: 'Game Cartridge', Component: GameCartridge, color: '#ffcc44' },
      { name: 'Memory Card', Component: MemoryCard, color: '#44ff44' },
      { name: 'Controller Grip', Component: ControllerGrip, color: '#44ff44' },
      { name: 'Thumbstick Caps', Component: ThumbstickCaps, color: '#ff4444' },
      { name: 'Gaming Keyboard', Component: GamingKeyboard, color: '#ff44ff' },
      { name: 'Mouse Bungee', Component: MouseBungee, color: '#333344' },
      { name: 'Wrist Rest', Component: WristRest, color: '#ff44ff' },
      { name: 'Monitor Arm', Component: MonitorArm, color: '#555566' },
      { name: 'Cable Sleeve', Component: CableSleeve, color: '#ff00ff' },
      { name: 'Stream Mic', Component: StreamingMicrophone, color: '#ff4444' },
      { name: 'Green Screen', Component: GreenScreen, color: '#22cc44' },
      { name: 'Key Light', Component: KeyLight, color: '#ffffee' },
      { name: 'Capture Card', Component: CaptureCard, color: '#4488ff' },
      { name: 'Console Stand', Component: ConsoleStand, color: '#4488ff' },
      { name: 'Game Cases', Component: GameCaseStorage, color: '#4488ff' },
      { name: 'Amiibo Figure', Component: AmiiboFigure, color: '#ffcc44' },
      { name: 'Pop Figure', Component: PopFigure, color: '#ff4444' },
      { name: 'Esports Trophy', Component: EsportsTrophy, color: '#ffdd44' },
      { name: 'LAN Cable', Component: LANCable, color: '#ffcc44' },
      { name: 'Chair Footrest', Component: GamingChairFootrest, color: '#ff4444' },
    ],
  },
  {
    id: 'science', name: 'Science & Lab', icon: '🔬',
    props: [
      { name: 'Microscope', Component: Microscope, color: '#ffffdd' },
      { name: 'Test Tubes', Component: TestTubes, color: '#ff4466' },
      { name: 'Beaker', Component: Beaker, color: '#44ddaa' },
      { name: 'Bunsen Burner', Component: BunsenBurner, color: '#4488ff' },
      { name: 'Molecular Model', Component: MolecularModel, color: '#ff4444' },
      { name: 'Telescope', Component: Telescope, color: '#ddddee' },
      { name: 'Magnifying Glass', Component: MagnifyingGlass, color: '#cc8833' },
      { name: 'Safety Goggles', Component: SafetyGoggles, color: '#4488ff' },
      { name: 'Petri Dish', Component: PetriDish, color: '#44aa44' },
      { name: 'Thermometer', Component: Thermometer, color: '#ff2244' },
      { name: 'Burner Tripod', Component: BunsenBurnerTripod, color: '#888899' },
      { name: 'Crucible Tongs', Component: CrucibleTongs, color: '#888899' },
      { name: 'Stirring Rod', Component: StirringRod, color: '#ccddee' },
      { name: 'Dropper Bottle', Component: DropperBottle, color: '#ff8844' },
      { name: 'Pipette Stand', Component: PipetteStand, color: '#4488ff' },
      { name: 'Lab Notebook', Component: LabNotebook, color: '#222266' },
      { name: 'Safety Shower', Component: SafetyShower, color: '#ffcc44' },
      { name: 'Fume Hood', Component: FumeHoodModel, color: '#44ff44' },
      { name: 'Autoclave', Component: Autoclave, color: '#ff4444' },
      { name: 'Centrifuge', Component: Centrifuge, color: '#4488ff' },
      { name: 'pH Meter', Component: PHMeter, color: '#44ccaa' },
      { name: 'Litmus Paper', Component: LitmusPaper, color: '#ff8844' },
      { name: 'Graduated Cylinder', Component: GraduatedCylinder, color: '#4488ff' },
      { name: 'Conical Flask', Component: ConicalFlask, color: '#88ddaa' },
      { name: 'Mortar & Pestle', Component: MortarAndPestle, color: '#aaaacc' },
      { name: 'Lab Timer', Component: LabTimer, color: '#ff4444' },
      { name: 'Specimen Jar', Component: SpecimenJar, color: '#ddcc88' },
      { name: 'Microscope Slides', Component: MicroscopeSlides, color: '#ccddee' },
      { name: 'Cover Slips', Component: CoverSlips, color: '#eeeeff' },
      { name: 'Lab Apron', Component: LabApron, color: '#ffffff' },
    ],
  },
  {
    id: 'workshop', name: 'Workshop & Tools', icon: '🔧',
    props: [
      { name: 'Hammer', Component: Hammer, color: '#aa7744' },
      { name: 'Drill', Component: Drill, color: '#22aa44' },
      { name: 'Toolbox', Component: Toolbox, color: '#cc2222' },
      { name: 'Measuring Tape', Component: MeasuringTape, color: '#ffcc22' },
      { name: 'Wrench', Component: Wrench, color: '#aaaacc' },
      { name: 'Paint Can', Component: PaintCan, color: '#4488ff' },
      { name: 'Workbench', Component: Workbench, color: '#aa8844' },
      { name: 'Safety Helmet', Component: SafetyHelmet, color: '#ffcc00' },
      { name: 'Screwdriver', Component: Screwdriver, color: '#ff6622' },
      { name: 'Wood Planks', Component: WoodPlanks, color: '#bb8844' },
      { name: 'Chisel Set', Component: ChiselSet, color: '#bb9966' },
      { name: 'Wood Plane', Component: WoodPlane, color: '#bb9955' },
      { name: 'C-Clamp', Component: CClamp, color: '#ff6622' },
      { name: 'Angle Grinder', Component: AngleGrinder, color: '#44aa44' },
      { name: 'Jigsaw', Component: Jigsaw, color: '#ff8822' },
      { name: 'Circular Saw', Component: CircularSaw, color: '#ffcc22' },
      { name: 'Wood Router', Component: WoodRouter, color: '#44aa44' },
      { name: 'Orbital Sander', Component: OrbitalSander, color: '#ffcc22' },
      { name: 'Nail Gun', Component: NailGun, color: '#ffcc22' },
      { name: 'Staple Gun', Component: StapleGun, color: '#888899' },
      { name: 'Wire Cutters', Component: WireCutters, color: '#ff4444' },
      { name: 'Needle Nose Pliers', Component: NeedleNosePliers, color: '#ff4444' },
      { name: 'Allen Key Set', Component: AllenKeySet, color: '#888899' },
      { name: 'Socket Wrench Set', Component: SocketWrenchSet, color: '#ff4444' },
      { name: 'Torque Wrench', Component: TorqueWrench, color: '#aaaacc' },
      { name: 'Pipe Wrench', Component: PipeWrench, color: '#ff4444' },
      { name: 'Adjustable Spanner', Component: AdjustableSpanner, color: '#aaaacc' },
      { name: 'Utility Knife', Component: UtilityKnife, color: '#ffcc22' },
      { name: 'Tape Measure XL', Component: LargeTapeMeasure, color: '#ffcc22' },
      { name: 'Work Light', Component: WorkLight, color: '#ffffcc' },
    ],
  },
];

function PropCard({ name, Component, color, index }: {
  readonly name: string;
  readonly Component: React.FC;
  readonly color: string;
  readonly index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '0.85',
        minHeight: 400,
        borderRadius: 16,
        background: 'linear-gradient(145deg, #12122a, #1a1a3a)',
        border: `1px solid ${hovered ? color : '#2a2a4a'}`,
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? `0 0 30px ${color}33` : 'none',
        overflow: 'hidden',
        cursor: 'grab',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0.5, 3]} fov={35} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 3]} intensity={1} />
        <pointLight position={[-2, 2, 2]} intensity={0.5} color={color} />
        <Suspense fallback={null}>
          <Component />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 0 10px',
          textAlign: 'center',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          color: hovered ? color : '#aaaacc',
          fontWeight: 600,
          fontSize: 16,
          letterSpacing: 0.5,
          transition: 'color 0.3s ease',
          pointerEvents: 'none',
        }}
      >
        {name}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          color: '#555577',
          fontSize: 11,
          fontWeight: 500,
          pointerEvents: 'none',
        }}
      >
        #{String(index + 1).padStart(2, '0')}
      </div>
    </div>
  );
}

const PROPS_PER_PAGE = 5;

export default function PropShowcase() {
  const [activeTab, setActiveTab] = useState('general');
  const [currentPage, setCurrentPage] = useState(0);
  const activeCategory = categories.find(c => c.id === activeTab)!;
  const totalProps = categories.reduce((sum, c) => sum + c.props.length, 0);

  const totalPages = Math.ceil(activeCategory.props.length / PROPS_PER_PAGE);
  const startIdx = currentPage * PROPS_PER_PAGE;
  const endIdx = startIdx + PROPS_PER_PAGE;
  const visibleProps = activeCategory.props.slice(startIdx, endIdx);

  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #0a0a1a, #0f0f2a)',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        padding: '16px 40px 8px',
        flexShrink: 0,
      }}>
        <h1 style={{
          color: '#eeeeff',
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          letterSpacing: 1,
        }}>
          🎨 PropCreator Design Showcase
        </h1>
        <p style={{
          color: '#6666aa',
          fontSize: 14,
          marginTop: 6,
        }}>
          {totalProps} unique prop designs across {categories.length} categories • CrewHub R&D
        </p>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '0 40px 12px',
        flexShrink: 0,
        overflowX: 'auto',
        justifyContent: 'center',
      }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.3,
              transition: 'all 0.25s ease',
              background: activeTab === cat.id
                ? 'linear-gradient(135deg, #3344aa, #4466cc)'
                : 'rgba(255,255,255,0.05)',
              color: activeTab === cat.id ? '#ffffff' : '#7777aa',
              boxShadow: activeTab === cat.id ? '0 2px 12px rgba(50,80,200,0.3)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.icon} {cat.name}
            <span style={{
              marginLeft: 6,
              fontSize: 11,
              opacity: 0.6,
            }}>
              ({cat.props.length})
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 40px 40px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {visibleProps.map((prop, i) => (
            <PropCard key={`${activeTab}-${prop.name}`} {...prop} index={startIdx + i} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '2rem auto',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 8,
            maxWidth: 1200,
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              style={{
                padding: '0.5rem 1.5rem',
                background: 'rgba(255, 215, 0, 0.2)',
                border: '1px solid rgba(255, 215, 0, 0.4)',
                borderRadius: 6,
                color: '#ffd700',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 0 ? 0.3 : 1,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              ← Previous
            </button>
            <span style={{ color: '#fff', fontSize: 14 }}>
              Page {currentPage + 1} of {totalPages} ({visibleProps.length} props)
            </span>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={endIdx >= activeCategory.props.length}
              style={{
                padding: '0.5rem 1.5rem',
                background: 'rgba(255, 215, 0, 0.2)',
                border: '1px solid rgba(255, 215, 0, 0.4)',
                borderRadius: 6,
                color: '#ffd700',
                cursor: endIdx >= activeCategory.props.length ? 'not-allowed' : 'pointer',
                opacity: endIdx >= activeCategory.props.length ? 0.3 : 1,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
