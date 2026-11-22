// Vertical → sub-vertical → niche taxonomy, and a deterministic classifier used for BOTH the user's idea
// and every company in the dataset, so "closest companies" always come from the same space.
//
// Term syntax (comma-separated): plain = 2 pts (phrases 3), "!term" = strong (4), "~term" = weak (0.7).
// `sector` is the base-rate sector key used by the simulation; `moon` (0-1) is how moonshot-like the space is.

const STOP = new Set(('a an the and or but for to of in on at by with from into onto via as is are be been being ' +
  'it its this that these those my our your their we you they i me us them app apps platform startup company ' +
  'like uber airbnb tinder netflix spotify amazon based using use uses new better best way ways get gets ' +
  'help helps people make makes simple easy online digital service services lets let allow allows ' +
  'which who what where when how all any every more most just only very really can will would should could also so ' +
  'world global first build builds building do does one two').split(/\s+/));

const KEEP_S = /(ous|ss|us|ics|sis)$/;
const SYN = { robotic: 'robot', robotics: 'robot', humanoids: 'humanoid', llms: 'llm', gpus: 'gpu', evs: 'ev', uavs: 'uav',
  ebike: 'e-bike', groceries: 'grocery', dexterous: 'dexterity', autonomously: 'autonomous', defence: 'defense', satellit: 'satellite' };

export function stem(w) {
  if (SYN[w]) return SYN[w];
  let s = w;
  if (s.length > 5 && s.endsWith('ing')) {
    s = s.slice(0, -3);
    if (/([bdgklmnprt])\1$/.test(s)) s = s.slice(0, -1);
  } else if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
  else if (s.length > 4 && /(ch|sh|x|ss)es$/.test(s)) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('s') && !KEEP_S.test(s)) s = s.slice(0, -1);
  else if (s.length > 5 && s.endsWith('ed')) s = s.slice(0, -2);
  return SYN[s] || s;
}

export function tokenize(text) {
  return (text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+\s-]/g, ' ').split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}
const norm = (text) => ' ' + tokenize(text).join(' ') + ' ';

export const TAXONOMY = [
  { id: 'robotics', label: 'Robotics', sector: 'hardware_iot', moon: 0.5, related: ['ai', 'mobility', 'hardware', 'logistics', 'defense'],
    terms: '!robot, ~automation, ~actuator, ~servo, ~motor control',
    subs: [
      { id: 'humanoids', label: 'Humanoid robots', moon: 0.85, terms: 'two legged, walking robot, robot worker, general purpose humanoid, !humanoid, bipedal, general purpose robot, android robot, legged robot, robot butler, household robot, home humanoid' },
      { id: 'manipulation', label: 'Manipulation & robot hands', moon: 0.5, terms: 'grip, manipulator, robot movement, bimanual, robot finger, ~hand, ~precise, ~precision, smooth motion, arm control, !robot hand, robot arm, !dexterity, !gripper, grasp, manipulation, pick and place, end effector, fine motor, hand movement, hand motion, finger, tactile, touch sensing, motion control, motion planning, trajectory, robot joint' },
      { id: 'robot_learning', label: 'Robot learning & embodied AI', moon: 0.65, terms: 'teach robot, robot task, new task, learn from video, learn from human, human demonstration, demonstration, watch video, robot dataset, generalist robot, reinforcement learning, robot skill, !embodied ai, !robot learning, !robot foundation model, !physical ai, !teleoperation, teleop, model robot, robot model, ai robot, robot ai, train robot, robot train, imitation learning, sim to real, robot simulation, robot brain, vision language action, robot policy, robot training data, robot data, robot intelligence, robot software, robot operating system, general purpose robot brain' },
      { id: 'industrial', label: 'Industrial & warehouse robots', moon: 0.35, terms: 'manufacturing, production line, robotic workcell, automate factory, sorting robot, warehouse robot, industrial robot, factory automation, factory, small factory, cobot, collaborative robot, palletiz, assembly line, robot weld, autonomous mobile robot, amr, fulfillment robot, picking robot, warehouse automation, manufacturing robot, machine tending, factory robot' },
      { id: 'drones', label: 'Drones', moon: 0.5, terms: 'flying robot, drone inspection, drone show, !drone, !uav, quadcopter, drone delivery, unmanned aerial, aerial robot' },
      { id: 'home_robots', label: 'Home & companion robots', moon: 0.45, terms: 'mop, household chore robot, lawn, home robot, robot vacuum, companion robot, social robot, lawn robot, pet robot, toy robot, elder care robot, robot pet' },
      { id: 'delivery_robots', label: 'Delivery robots', moon: 0.4, terms: '!delivery robot, sidewalk robot, last mile robot, robot courier' },
      { id: 'field_robots', label: 'Field robots (farm, construction, inspection)', moon: 0.45, terms: '!autonomous tractor, tractor, robot weed, crop robot, panel cleaning robot, pipe inspection, agricultural robot, farm robot, weeding robot, harvesting robot, construction robot, inspection robot, underwater robot, mining robot, robot dog, quadruped' },
      { id: 'exoskeletons', label: 'Exoskeletons', moon: 0.55, terms: '!exoskeleton, wearable robot, powered suit' },
    ] },
  { id: 'space', label: 'Space', sector: 'deeptech_space', moon: 0.85, related: ['defense', 'semis', 'mobility'],
    terms: '!space, !orbit, orbital, spacecraft, aerospace, nasa',
    subs: [
      { id: 'launch', label: 'Launch & rockets', moon: 0.9, terms: 'launch satellite, spaceport, rocket launch, !rocket, launch vehicle, reusable rocket, small launch, launcher, launch service, rocket engine, orbital launch, smallsat launch' },
      { id: 'sat_comms', label: 'Satellite connectivity', moon: 0.8, terms: 'satellite internet, satellite broadband, constellation, direct to cell, satellite phone, low earth orbit, leo, satellite communication' },
      { id: 'earth_obs', label: 'Earth observation & space data', moon: 0.55, terms: 'satellite photograph, photograph earth, photograph farm, image earth, earth imag, monitor from space, space data, satellite analytics, !earth observation, satellite imagery, satellite image, remote sensing, sar, hyperspectral, satellite data, geospatial' },
      { id: 'in_space', label: 'In-space economy & exploration', moon: 1, terms: 'refuel satellite, satellite refuel, satellite servicing, space tug, satellite repair, !in orbit, !in space, orbital factory, manufactur in orbit, factory in orbit, print in orbit, !moon, helium 3, space mining, lunar mining, regolith, outer space, space factory, microgravity, orbital station, !space station, in space manufacturing, orbital servicing, space debris, lunar, moon base, moon landing, mars, asteroid, asteroid mining, space tourism, spaceship, coloniz, multiplanetary, interplanetary, space habitat, lunar lander' },
      { id: 'sat_hardware', label: 'Satellites & spacecraft hardware', moon: 0.7, terms: 'satellite, cubesat, smallsat, satellite bus, space propulsion, satellite manufactur' },
    ] },
  { id: 'ai', label: 'AI', sector: 'ai_ml', moon: 0.4, related: ['devtools', 'semis', 'robotics', 'saas'],
    terms: '~ai, ~artificial intelligence, ~machine learning, ~ml, ~neural network, ~deep learning, ~generative, ~genai, ~gpt',
    subs: [
      { id: 'foundation_models', label: 'Foundation models & architectures', moon: 0.7, terms: 'ai model, smaller model, small model, efficient model, smart as gpt, gpt level, llm, train llm, licensed data, open model, model weight, pretrained model, base model, frontier lab, ai lab, !foundation model, !large language model, !frontier model, !model architecture, model lab, train model, pretrain, transformer, new architecture, state space model, mixture of expert, reasoning model, multimodal model, open source model, open weight, agi, superintelligence, world model, small language model, language model, model training, train ai model' },
      { id: 'ai_infra', label: 'AI infrastructure & tooling', moon: 0.35, terms: '!hallucination, test llm, llm app, evaluat llm, llm test, !llm observability, prompt management, ai testing, cheaper inference, run model, serve model, !inference, inference api, model serving, mlops, !vector database, fine tun, model evaluation, evals, ai observability, data label, training data, synthetic data, ai safety, guardrail, model hosting, rag, retrieval, embedding, model router, ai gateway, llm ops' },
      { id: 'ai_compute', label: 'Data centers & GPU cloud', moon: 0.45, terms: '!gpu cloud, !data center, !datacenter, ai data center, gpu rental, rent gpu, compute marketplace, ai compute, gpu cluster, training cluster, ai cloud, neocloud, colocation, hyperscale, liquid cooling, immersion cooling, cooling for data center, power for data center, data center power, compute capacity, gpu capacity, gpu as a service, cloud for training, compute for training, gpu for training, gpu for ai, gpus for' },
      { id: 'ai_agents', label: 'AI agents & assistants', moon: 0.4, terms: 'answer email, schedul assistant, ai concierge, inbox, !ai search, answer engine, ai search engine, search engine, research assistant, deep research, !ai agent, agent, agentic, autonomous agent, copilot, ai assistant, personal assistant, chatbot, browser agent, computer use, voice agent, ai employee, digital worker, automate task, ai receptionist, operate software' },
      { id: 'genai_media', label: 'Generative media', moon: 0.3, terms: 'game asset, 3d asset, diffusion model, generate 3d, 3d generation, narration, dubbing, voiceover, ai dub, ai image, image generation, ai video, video generation, generative video, ai voice, voice clon, text to speech, ai music, music generation, ai avatar, avatar, deepfake, ai art, text to image, text to video, ai companion' },
      { id: 'ai_vision', label: 'Computer vision', moon: 0.35, terms: '!computer vision, image recognition, facial recognition, object detection, visual inspection, camera ai' },
    ] },
  { id: 'devtools', label: 'Developer tools & cloud', sector: 'devtools_infra', moon: 0.2, related: ['ai', 'saas', 'security'],
    terms: '!developer, devtool, api, sdk, open source, software engineer, programmer, programming',
    subs: [
      { id: 'ai_coding', label: 'AI coding', moon: 0.35, terms: '!ai coding, !code generation, coding assistant, code review, write code, generate code, code completion, ide, coding agent, software agent, ai software engineer, vibe coding' },
      { id: 'data_infra', label: 'Data infrastructure', moon: 0.2, terms: 'database, data warehouse, etl, data pipeline, data lake, streaming data, data platform, data stack' },
      { id: 'cloud_devops', label: 'Cloud & DevOps', moon: 0.2, terms: 'cloud hosting, hosting, devops, ci cd, deployment, kubernetes, serverless, observability, infrastructure monitoring, app monitoring, server monitoring, cloud infrastructure, edge computing, cdn' },
      { id: 'low_code', label: 'No-code & low-code', moon: 0.15, terms: 'no code, low code, website builder, app builder, internal tool, spreadsheet' },
      { id: 'dev_platforms', label: 'APIs & developer platforms', moon: 0.15, terms: 'api platform, communication api, sms api, version control, git, code host' },
    ] },
  { id: 'semis', label: 'Chips & quantum', sector: 'deeptech_space', moon: 0.7, related: ['ai', 'space', 'hardware'],
    terms: '!semiconductor, !chip, chipmaker, silicon, wafer',
    subs: [
      { id: 'ai_chips', label: 'AI & compute chips', moon: 0.7, terms: 'transformer chip, run transformer, ai workload, chip for ai, inference hardware, !ai chip, gpu, asic, accelerator, inference chip, tpu, npu, photonic, optical comput, neuromorphic, analog comput, risc v, processor, cpu, wafer scale, chiplet' },
      { id: 'quantum', label: 'Quantum computing', moon: 0.95, terms: '!quantum, qubit, quantum computer, trapped ion, superconducting qubit, quantum sensing, quantum network, quantum cryptography' },
      { id: 'sensors', label: 'Sensors, lidar & photonics', moon: 0.5, terms: '!lidar, sensor, image sensor, radar, photonics, laser, mems' },
      { id: 'semis_mfg', label: 'Chip manufacturing & materials', moon: 0.8, terms: 'lithography, foundry, chip fab, semiconductor manufactur, euv, superconductor, advanced material' },
    ] },
  { id: 'mobility', label: 'Mobility', sector: 'mobility_transport', moon: 0.3, related: ['robotics', 'climate', 'logistics'],
    terms: 'car, vehicle, transport, transportation, driver, mobility, commute, ride',
    subs: [
      { id: 'autonomous_vehicles', label: 'Autonomous vehicles', moon: 0.65, terms: '!self driving, !autonomous vehicle, !robotaxi, autonomous truck, self driving truck, driverless truck, autonomous driving, driverless, adas, driver assistance, autonomous car' },
      { id: 'ride_hailing', label: 'Ride-hailing', moon: 0.2, terms: '!ride hailing, rideshare, ride shar, taxi, carpool, black car, cab, bike taxi' },
      { id: 'micromobility', label: 'Micromobility', moon: 0.2, terms: '!scooter, e-bike, bike share, bike shar, bicycle, moped, dockless' },
      { id: 'evs', label: 'Electric vehicles', moon: 0.55, terms: '!electric vehicle, ev, electric car, electric truck, electric motorcycle, electric bus, ev maker, electric van, electric scooter maker' },
      { id: 'air_mobility', label: 'Air mobility & aviation', moon: 0.8, terms: '!evtol, !air taxi, flying car, electric plane, electric aircraft, supersonic, aviation, airline, aircraft, airplane, hypersonic, air mobility' },
      { id: 'transport_infra', label: 'Transport infrastructure', moon: 0.9, terms: '!hyperloop, high speed rail, tunnel, maglev' },
      { id: 'car_commerce', label: 'Car buying, rental & sharing', moon: 0.15, terms: 'rent out car, rent car, peer to peer car, car owner, idle car, !used car, car marketplace, car subscription, car rental, car shar, buy car, sell car, auto loan, car dealer, car leas, online car' },
      { id: 'transit_fleet', label: 'Transit, parking & fleets', moon: 0.15, terms: 'parking, transit, public transport, bus, fleet management, shuttle, journey planner' },
      { id: 'auto_services', label: 'Car services', moon: 0.1, terms: 'car repair, car service, car wash, mechanic, auto repair, car servic' },
    ] },
  { id: 'climate', label: 'Climate & energy', sector: 'climate_energy', moon: 0.55, related: ['mobility', 'space', 'semis'],
    terms: 'climate, energy, clean energy, emission, decarboniz, sustainability, net zero, cleantech',
    subs: [
      { id: 'fusion_nuclear', label: 'Fusion & nuclear', moon: 1, terms: '!fusion, !nuclear, reactor, smr, small modular reactor, fission, tokamak, stellarator' },
      { id: 'batteries', label: 'Batteries & storage', moon: 0.6, terms: '!battery, energy storage, solid state battery, grid storage, lithium, sodium ion, battery cell, battery recycl, gigafactory' },
      { id: 'renewables', label: 'Solar, wind & hydrogen', moon: 0.45, terms: '!solar, solar panel, wind turbine, wind farm, renewable, geothermal, hydrogen, electrolyzer, green hydrogen, photovoltaic, thin film' },
      { id: 'carbon', label: 'Carbon removal & markets', moon: 0.65, terms: '!carbon capture, !carbon removal, direct air capture, carbon credit, carbon offset, sequestration, co2, carbon account, carbon market' },
      { id: 'ev_charging', label: 'EV charging & battery swap', moon: 0.35, terms: '!charging station, ev charg, charger, battery swap, charging network' },
      { id: 'grid', label: 'Grid & energy software', moon: 0.3, terms: 'power grid, energy management, smart meter, utility, demand response, virtual power plant, power trad, home energy, electricity' },
      { id: 'materials_waste', label: 'Recycling & green materials', moon: 0.45, terms: 'recycl, waste, circular, plastic, compost, green steel, cement, low carbon material' },
    ] },
  { id: 'health', label: 'Health', sector: 'healthtech', moon: 0.35, related: ['bio', 'ai', 'insurance'],
    terms: 'health, healthcare, patient, doctor, clinic, medical, hospital',
    subs: [
      { id: 'telehealth', label: 'Telehealth & primary care', moon: 0.2, terms: '!telehealth, !telemedicine, virtual care, online doctor, virtual clinic, primary care, doctor on demand' },
      { id: 'mental_health', label: 'Mental health', moon: 0.2, terms: '!mental health, therapy, therapist, anxiety, depression, meditation, counsel, psychiatr' },
      { id: 'digital_therapeutics', label: 'Digital therapeutics & chronic care', moon: 0.3, terms: '!digital therapeutic, prescription app, chronic disease, diabetes, behavioral therapy, addiction treatment' },
      { id: 'medtech', label: 'Medical devices & diagnostics', moon: 0.5, terms: '!glucose, glucose monitor, cgm, biomarker, blood sugar, continuous monitor, !medical device, diagnostic, blood test, health monitor, imaging, ultrasound, mri, cancer screen, at home test, lab test, finger prick, !radiology, medical imag, scan, x ray, ct scan, pathology, diagnos' },
      { id: 'surgical_robotics', label: 'Surgical robotics', moon: 0.6, terms: '!surgical robot, robotic surgery, surgery robot, surgical' },
      { id: 'neurotech', label: 'Brain-computer interfaces', moon: 0.9, terms: '!brain computer interface, !bci, neural implant, brain implant, neurotech, neural interface, paralyz, brain signal, mind control' },
      { id: 'health_admin', label: 'Healthcare admin & billing', moon: 0.15, terms: 'medical billing, ehr, electronic health record, prior authorization, revenue cycle, healthcare admin, hospital operation, health records, medical scribe, ai scribe, clinical notes, clinical documentation, ambient documentation, medical coding, patient intake, scribe' },
      { id: 'pharmacy', label: 'Pharmacy & medication', moon: 0.15, terms: '!pharmacy, prescription, medication, medicine delivery, pill' },
      { id: 'fitness', label: 'Fitness & wellness', moon: 0.15, terms: 'fitness, workout, gym, exercise, connected bike, personal trainer, wellness, sleep, nutrition, diet, weight loss' },
      { id: 'femtech', label: "Women's health", moon: 0.2, terms: '!fertility, women health, period track, pregnancy, ivf, menopause, femtech' },
    ] },
  { id: 'bio', label: 'Biotech', sector: 'biotech', moon: 0.7, related: ['health', 'ai', 'food'],
    terms: '!biotech, biology, therapeutic, drug, molecule, clinical trial, protein, dna',
    subs: [
      { id: 'drug_discovery', label: 'Drug discovery', moon: 0.7, terms: 'design protein, new protein, medicine, design drug, design molecule, ai designs drug, !drug discovery, small molecule, drug candidate, protein design, protein fold, antibody, target discovery, rare disease, oncology, cancer drug, new drug' },
      { id: 'gene_cell', label: 'Gene & cell therapy', moon: 0.8, terms: '!gene therapy, !gene edit, !crispr, cell therapy, car t, mrna, vaccine, rna' },
      { id: 'synbio', label: 'Synthetic biology', moon: 0.6, terms: '!synthetic biology, synbio, engineered microbe, biomanufactur, fermentation, precision fermentation, enzyme' },
      { id: 'longevity', label: 'Longevity', moon: 0.9, terms: 'live longer, live forever, extend life, healthspan, slow aging, age slower, !longevity, anti aging, aging, lifespan, rejuvenat, senolytic, immortality, reverse aging' },
      { id: 'bio_tools', label: 'Genomics & lab tools', moon: 0.5, terms: 'genome sequenc, sequenc, lab automation, lab equipment, bioinformatic, genomic, dna sequenc, blood testing device' },
    ] },
  { id: 'fintech', label: 'Fintech', sector: 'fintech', moon: 0.2, related: ['crypto', 'insurance', 'saas'],
    terms: 'fintech, finance, financial, money, bank, banking',
    subs: [
      { id: 'payments', label: 'Payments', moon: 0.2, terms: '!payment, checkout, payment process, merchant, point of sale, pos, payment gateway, card issu, upi' },
      { id: 'neobank', label: 'Neobanks & wallets', moon: 0.2, terms: '!neobank, digital bank, challenger bank, bank account, debit card, mobile bank, banking app, unbanked, mobile money, wallet, bank for' },
      { id: 'lending', label: 'Lending & credit', moon: 0.2, terms: '!loan, lending, credit, microloan, credit score, borrow, lend, p2p lend, payday' },
      { id: 'bnpl', label: 'Buy now, pay later', moon: 0.2, terms: '!buy now pay later, !bnpl, installment, pay later, pay in installment' },
      { id: 'wealth', label: 'Investing & trading', moon: 0.2, terms: '!invest, brokerage, trading, stock, robo advisor, wealth, saving, retirement, trade stock' },
      { id: 'remittance', label: 'Remittances & FX', moon: 0.15, terms: '!remittance, money transfer, cross border, send money, foreign exchange, fx' },
      { id: 'b2b_finance', label: 'Business finance & accounting', moon: 0.2, terms: 'invoice, invoic, expense, expense management, corporate card, accounts payable, treasury, spend management, !accounting, !bookkeep, tax, cfo, accountant, close the book, audit, payroll tax, financial close, reconcil' },
      { id: 'capital_markets', label: 'Capital markets & investment research', moon: 0.2, terms: '!hedge fund, !investment research, equity research, earnings call, financial analyst, analyst, asset manager, private equity, venture capital, due diligence, investment bank, deal sourcing, financial research, financial data, market data, fund manager, portfolio manag' },
    ] },
  { id: 'crypto', label: 'Crypto & web3', sector: 'crypto_web3', moon: 0.4, related: ['fintech'],
    terms: '!crypto, !blockchain, !stablecoin, web3, onchain, token, bitcoin, ethereum',
    subs: [
      { id: 'exchanges', label: 'Exchanges & custody', moon: 0.3, terms: 'crypto trader, trader, trading terminal, market data, crypto trading, !crypto exchange, exchange, custody, crypto lend' },
      { id: 'defi', label: 'DeFi', moon: 0.4, terms: '!defi, decentralized finance, lending protocol, yield, dex' },
      { id: 'nft', label: 'NFTs & digital collectibles', moon: 0.3, terms: '!nft, digital collectible' },
      { id: 'stablecoins', label: 'Stablecoins & crypto payments', moon: 0.35, terms: '!stablecoin, usdc, usdt, digital dollar, crypto payment' },
      { id: 'chain_infra', label: 'Blockchain infrastructure', moon: 0.45, terms: 'layer 2, rollup, node, validator, smart contract, wallet infrastructure' },
    ] },
  { id: 'commerce', label: 'E-commerce & marketplaces', sector: 'ecommerce_marketplace', moon: 0.15, related: ['delivery', 'logistics', 'fintech'],
    terms: 'ecommerce, commerce, shop, shopping, store, retail, buy, sell, seller, buyer, ~marketplace',
    subs: [
      { id: 'resale', label: 'Resale & secondhand', moon: 0.15, terms: '!secondhand, second hand, !resale, used, used luxury, pre owned, secondhand luxury, thrift, preloved, refurbish, consignment' },
      { id: 'fashion_beauty', label: 'Fashion & beauty commerce', moon: 0.15, terms: 'dress, designer, clothing rental, rent dress, wardrobe, rent the runway, outfit, fashion, clothing, apparel, shoe, sneaker, handbag, luxury, beauty, cosmetic, jewelry, eyewear' },
      { id: 'b2b_marketplace', label: 'B2B marketplaces & wholesale', moon: 0.15, terms: 'small shop, shopkeeper, order inventory, restock, mom and pop, informal retail, neighborhood store, corner store, kirana store, duka, !b2b marketplace, wholesale, supplier, procurement, sourcing, distributor, kirana, retailer supply, small retailer' },
      { id: 'social_commerce', label: 'Social & live commerce', moon: 0.15, terms: '!social commerce, live shopp, livestream shopp, group buy, community commerce, influencer shopp' },
      { id: 'ecom_platforms', label: 'E-commerce platforms & tools', moon: 0.15, terms: 'online store, storefront, ecommerce platform, dropship, cross border ecommerce' },
      { id: 'deals', label: 'Deals & flash sales', moon: 0.1, terms: '!flash sale, daily deal, coupon, deal, discount, group discount' },
      { id: 'd2c', label: 'D2C brands & subscriptions', moon: 0.15, terms: '!d2c, direct to consumer, subscription box, mattress, razor, brand' },
      { id: 'general_marketplace', label: 'General e-commerce', moon: 0.15, terms: 'online marketplace, everything store, online retail, e-tailer' },
    ] },
  { id: 'delivery', label: 'Delivery & quick commerce', sector: 'quick_commerce_delivery', moon: 0.2, related: ['commerce', 'food', 'logistics'],
    terms: '!delivery, deliver, courier',
    subs: [
      { id: 'quick_commerce', label: 'Quick commerce', moon: 0.2, terms: '!dark store, !quick commerce, 10 minute, minute delivery, instant delivery, q commerce, ultrafast' },
      { id: 'food_delivery', label: 'Food delivery', moon: 0.15, terms: '!food delivery, restaurant delivery, takeaway, takeout, meal delivery' },
      { id: 'grocery', label: 'Online grocery', moon: 0.15, terms: '!grocery, online grocery, supermarket' },
      { id: 'courier', label: 'Courier & anything delivery', moon: 0.15, terms: 'anything delivery, deliver anything, errand, parcel, package delivery, same day delivery, last mile' },
    ] },
  { id: 'food', label: 'Food', sector: 'foodtech', moon: 0.3, related: ['delivery', 'bio', 'agri'],
    terms: 'food, meal, restaurant, kitchen, eat, cook',
    subs: [
      { id: 'alt_protein', label: 'Alternative protein', moon: 0.55, terms: 'lab grown, cultivated, cultured meat, cell cultured, plant burger, plant meat, plant protein, plant milk, meatless, veggie burger, fake meat, mycoprotein, fungi protein, !plant based, !meat alternative, !cultivated meat, lab grown meat, alternative protein, vegan, dairy free, cell based meat, insect protein, taste like beef' },
      { id: 'cloud_kitchens', label: 'Cloud kitchens', moon: 0.2, terms: '!cloud kitchen, ghost kitchen, dark kitchen, virtual restaurant, delivery only restaurant' },
      { id: 'restaurant_tech', label: 'Restaurant tech', moon: 0.15, terms: 'restaurant software, reservation, table book, restaurant pos, restaurant, restaurant owner, phone order, take order, kitchen display, answer phone' },
      { id: 'cpg', label: 'Food & beverage brands', moon: 0.15, terms: 'beverage, drink, snack, coffee, juice, tea, beer, energy drink' },
      { id: 'food_robotics', label: 'Food robotics', moon: 0.45, terms: '!robot chef, kitchen robot, robotic kitchen, food robot, pizza robot, automated kitchen, cook burger, burger robot, cooking robot, robot cook, fry robot, fast food robot, food prep robot' },
      { id: 'meal_kits', label: 'Meal kits', moon: 0.15, terms: '!meal kit, recipe box, meal plan' },
    ] },
  { id: 'property', label: 'Real estate', sector: 'proptech_realestate', moon: 0.2, related: ['fintech', 'travel'],
    terms: 'real estate, property, house, housing, apartment',
    subs: [
      { id: 'rentals', label: 'Rentals', moon: 0.15, terms: '~rent, rent apartment, rent home, rental, landlord, tenant, lease, roommate' },
      { id: 'brokerage', label: 'Home buying & brokerage', moon: 0.2, terms: 'buy home, sell home, ibuyer, real estate agent, brokerage, listing, home buy, home sell, estate agent' },
      { id: 'workspace_living', label: 'Coworking & coliving', moon: 0.2, terms: '!coworking, !coliving, flexible office, office space, shared office, workspace' },
      { id: 'construction', label: 'Construction tech', moon: 0.35, terms: 'construction, builder, prefab, modular home, 3d printed house, construction tech' },
      { id: 'mortgage', label: 'Mortgages', moon: 0.15, terms: '!mortgage, home loan' },
    ] },
  { id: 'travel', label: 'Travel', sector: 'travel_hospitality', moon: 0.15, related: ['property', 'mobility'],
    terms: 'travel, trip, tourism, tourist, vacation, holiday, traveler',
    subs: [
      { id: 'home_sharing', label: 'Home sharing & stays', moon: 0.15, terms: '!air mattress, home shar, homestay, vacation rental, stranger apartment, spare room, short term rental, hotel alternative, apartment hotel' },
      { id: 'booking', label: 'Flights, hotels & booking', moon: 0.1, terms: 'book flight, flight, hotel, ota, airfare, travel agency, itinerary, airline ticket' },
      { id: 'experiences', label: 'Tours & experiences', moon: 0.1, terms: 'tour, experience, activity, travel guide' },
    ] },
  { id: 'edtech', label: 'Education', sector: 'edtech', moon: 0.15, related: ['work', 'ai'],
    terms: 'education, learn, learning, student, school, teacher, teach, course, study',
    subs: [
      { id: 'k12_tutoring', label: 'K-12 & tutoring', moon: 0.15, terms: 'kid coding, coding kid, teach kid, learn code, coding for kid, teach children, !tutor, homework, k12, kid, children, exam prep, test prep, coaching class' },
      { id: 'upskilling', label: 'Online courses & upskilling', moon: 0.15, terms: 'online course, bootcamp, upskill, reskill, certification, mooc, professional course' },
      { id: 'language', label: 'Language learning', moon: 0.1, terms: '!language learning, learn english, learn spanish, language' },
      { id: 'higher_ed', label: 'Higher education', moon: 0.1, terms: 'university, college, degree, campus' },
    ] },
  { id: 'work', label: 'Work & hiring', sector: 'hrtech_work', moon: 0.15, related: ['saas', 'edtech'],
    terms: 'job, worker, employee, employer, talent, hire, hiring, workforce',
    subs: [
      { id: 'recruiting', label: 'Recruiting & staffing', moon: 0.1, terms: 'professional network, blue collar, job network, job matching, co founder, cofounder, find cofounder, hire engineer, !recruit, job board, applicant, hiring platform, staffing, headhunt' },
      { id: 'freelance_gig', label: 'Freelance & gig work', moon: 0.1, terms: '!freelance, gig, gig worker, shift, temp work, side hustle' },
      { id: 'payroll_hr', label: 'Payroll & HR software', moon: 0.1, terms: '!payroll, hr software, human resource, employee benefit, onboard, peo' },
      { id: 'collaboration', label: 'Collaboration & productivity', moon: 0.1, terms: 'remote work, collaboration, team chat, video call, meeting, project management, productivity, note tak' },
    ] },
  { id: 'saas', label: 'B2B software', sector: 'saas_b2b', moon: 0.15, related: ['ai', 'devtools', 'work'],
    terms: 'saas, software, b2b, enterprise, ~business, smb, workflow',
    subs: [
      { id: 'sales_crm', label: 'Sales & CRM', moon: 0.1, terms: '!crm, sales, customer relationship, lead, outreach, sales team, !ai sdr, sdr, sales meeting, book meeting, cold email, outbound, prospect, lead gen, sales rep, revenue team' },
      { id: 'analytics_bi', label: 'Analytics & BI', moon: 0.1, terms: 'analytics, business intelligence, dashboard, report' },
      { id: 'vertical_saas', label: 'Vertical SaaS', moon: 0.1, terms: 'vertical saas, practice management, salon software, construction software, restaurant software, software for clinic' },
      { id: 'automation', label: 'Process automation', moon: 0.15, terms: '!rpa, robotic process automation, workflow automation, automate workflow, process automation, office task' },
      { id: 'customer_support', label: 'Customer support', moon: 0.1, terms: '!customer support, helpdesk, help desk, customer service, call center, contact center, support ticket, support agent, answer customer, customer question, support team, customer experience' },
    ] },
  { id: 'security', label: 'Security', sector: 'security', moon: 0.2, related: ['devtools', 'saas', 'defense'],
    terms: 'security, secure, cyber',
    subs: [
      { id: 'cybersecurity', label: 'Cybersecurity', moon: 0.2, terms: '!cybersecurity, cyber security, endpoint, firewall, malware, ransomware, threat, penetration test, vulnerability, !prompt injection, ai security, llm security, model security, ai red team, secure ai, security operation, soc analyst' },
      { id: 'identity', label: 'Identity & authentication', moon: 0.15, terms: 'identity, authentication, password, login, kyc, identity verification, biometric' },
      { id: 'fraud', label: 'Fraud prevention', moon: 0.15, terms: '!fraud detection, fraud, chargeback, scam' },
      { id: 'privacy', label: 'Privacy & encryption', moon: 0.15, terms: 'privacy, encryption, data protection, end to end encrypt' },
    ] },
  { id: 'defense', label: 'Defense', sector: 'legal_govtech', moon: 0.6, related: ['robotics', 'space', 'ai', 'security'],
    terms: '!defense, military, warfare, army, soldier, national security, ministry of defense',
    subs: [
      { id: 'defense_autonomy', label: 'Defense autonomy & drones', moon: 0.6, terms: 'military ai, enemy, intelligence analysis, battlefield ai, targeting, war, autonomous weapon, military drone, combat drone, counter drone, surveillance drone, loitering munition, border surveillance, battlefield, defense ai, defense software' },
      { id: 'defense_hw', label: 'Defense hardware', moon: 0.65, terms: 'missile, munition, armored, defense hardware, hypersonic weapon' },
    ] },
  { id: 'media', label: 'Media & entertainment', sector: 'media_content', moon: 0.15, related: ['social', 'gaming'],
    terms: 'media, content, entertainment, watch, viewer',
    subs: [
      { id: 'streaming', label: 'Video & streaming', moon: 0.15, terms: '!streaming, video stream, show, series, tv, television, hollywood, studio, film, movie, episode, short form video, premium video' },
      { id: 'audio', label: 'Music & audio', moon: 0.1, terms: '!podcast, audio, music, music stream, audiobook, radio' },
      { id: 'news_publishing', label: 'News & publishing', moon: 0.1, terms: '!news, publish, newsletter, journalism, magazine, blog' },
      { id: 'creator', label: 'Creator economy', moon: 0.1, terms: '!creator, influencer, youtuber, creator economy, fan, patreon' },
    ] },
  { id: 'social', label: 'Consumer social', sector: 'consumer_social', moon: 0.15, related: ['media', 'gaming'],
    terms: 'social, friend, community, follow, connect',
    subs: [
      { id: 'social_network', label: 'Social networks', moon: 0.15, terms: '!social network, social media, feed, photo shar, anonymous, status update' },
      { id: 'dating', label: 'Dating', moon: 0.1, terms: '!dating, date, match, single, relationship, matchmak' },
      { id: 'messaging', label: 'Messaging', moon: 0.1, terms: '!messaging, chat, messenger, group chat, voice chat' },
      { id: 'communities', label: 'Communities', moon: 0.1, terms: 'forum, club, neighbor, local community, neighborhood' },
    ] },
  { id: 'gaming', label: 'Gaming', sector: 'gaming', moon: 0.2, related: ['media', 'social'],
    terms: '!game, gaming, gamer, player',
    subs: [
      { id: 'mobile_games', label: 'Mobile & casual games', moon: 0.15, terms: '!mobile game, casual game, puzzle game, city builder, hyper casual' },
      { id: 'console_vr', label: 'Console, PC & VR games', moon: 0.2, terms: 'console, vr game, virtual reality game, pc game, game console' },
      { id: 'esports', label: 'Esports', moon: 0.15, terms: '!esports, tournament, competitive gaming' },
      { id: 'game_tools', label: 'Game engines & tools', moon: 0.2, terms: 'game engine, game development, game studio' },
    ] },
  { id: 'hardware', label: 'Consumer hardware', sector: 'hardware_iot', moon: 0.3, related: ['robotics', 'health', 'semis'],
    terms: 'hardware, device, gadget, iot, connected device',
    subs: [
      { id: 'wearables', label: 'Wearables', moon: 0.3, terms: '!wearable, smartwatch, smart ring, fitness tracker, earbud' },
      { id: 'smart_home', label: 'Smart home & appliances', moon: 0.2, terms: '!smart home, home automation, smart speaker, smart lock, kitchen appliance, juicer, appliance, thermostat, wi fi connected' },
      { id: 'ar_vr', label: 'AR / VR', moon: 0.5, terms: '!augmented reality, !virtual reality, ar, vr, headset, mixed reality, smart glass, metaverse' },
      { id: 'consumer_electronics', label: 'Consumer electronics', moon: 0.25, terms: 'phone, smartphone, laptop, camera, speaker, 3d printer, game console hardware, phone maker' },
    ] },
  { id: 'logistics', label: 'Logistics', sector: 'logistics_supplychain', moon: 0.2, related: ['delivery', 'robotics', 'mobility'],
    terms: '!logistics, supply chain, shipping, shipment, cargo',
    subs: [
      { id: 'freight', label: 'Trucking & freight', moon: 0.15, terms: '!freight, trucking, truck, shipper, carrier, load board, freight brokerage, digital freight, truckload, trucker' },
      { id: 'warehousing', label: 'Warehousing & fulfillment', moon: 0.2, terms: 'warehouse, fulfillment, 3pl, inventory, storage' },
      { id: 'supply_chain_sw', label: 'Supply chain software', moon: 0.15, terms: 'supply chain software, visibility, procurement software, inventory management, demand forecast' },
      { id: 'ocean_trade', label: 'Ocean freight & trade', moon: 0.15, terms: 'ocean freight, container, port, customs, freight forward' },
    ] },
  { id: 'home_services', label: 'On-demand services', sector: 'gig_services_ondemand', moon: 0.1, related: ['work', 'commerce'],
    terms: '~on demand, ~home service, ~vetted, ~book',
    subs: [
      { id: 'cleaning', label: 'Home cleaning', moon: 0.1, terms: '!cleaner, clean, maid, housekeep, home clean' },
      { id: 'repairs', label: 'Repairs & handymen', moon: 0.1, terms: '!handyman, plumber, electrician, home repair, appliance repair, pest control' },
      { id: 'laundry', label: 'Laundry', moon: 0.1, terms: '!laundry, dry clean, wash fold' },
      { id: 'beauty_services', label: 'Beauty & wellness at home', moon: 0.1, terms: 'salon at home, beauty at home, massage, haircut, spa, beautician, makeup artist, salon' },
      { id: 'pet_care', label: 'Pet care', moon: 0.1, terms: '!pet, dog, dog walk, pet sitt, pet care, veterinar, vet, cat' },
      { id: 'care_services', label: 'Child & elder care', moon: 0.1, terms: 'babysit, nanny, elder care, caregiver, childcare' },
    ] },
  { id: 'agri', label: 'Agriculture', sector: 'agritech', moon: 0.3, related: ['food', 'climate', 'robotics'],
    terms: 'farm, farmer, agriculture, crop, agri, harvest, tractor',
    subs: [
      { id: 'farm_tech', label: 'Farm tech', moon: 0.3, terms: 'precision agriculture, farm software, soil, irrigation, crop monitor, farm data' },
      { id: 'vertical_farming', label: 'Vertical & indoor farming', moon: 0.45, terms: '!vertical farm, indoor farm, greenhouse, hydroponic, aquaponic' },
      { id: 'agri_marketplace', label: 'Agri marketplaces & inputs', moon: 0.15, terms: 'farmer marketplace, farm to table, agri marketplace, produce marketplace, farm input' },
      { id: 'aquaculture', label: 'Aquaculture & fisheries', moon: 0.3, terms: '!aquaculture, fish, fishery, shrimp, seafood' },
      { id: 'livestock', label: 'Livestock', moon: 0.25, terms: 'livestock, cattle, dairy farm, poultry' },
    ] },
  { id: 'legal_gov', label: 'Legal & government', sector: 'legal_govtech', moon: 0.2, related: ['saas', 'ai'],
    terms: 'legal, law, government, public sector, civic',
    subs: [
      { id: 'legaltech', label: 'Legal tech', moon: 0.15, terms: '!lawyer, law firm, contract, legal document, legal ai, litigation, compliance, paralegal, court' },
      { id: 'govtech', label: 'Gov tech', moon: 0.15, terms: 'civic, public service, permit, voting, municipal, city government' },
    ] },
  { id: 'insurance', label: 'Insurance', sector: 'insurtech', moon: 0.15, related: ['fintech', 'health'],
    terms: '!insurance, insurer, insure, underwrit, claim, premium',
    subs: [
      { id: 'auto_ins', label: 'Car insurance', moon: 0.15, terms: '!car insurance, auto insurance, usage based insurance, how you drive, driving behavior, telematic' },
      { id: 'health_ins', label: 'Health insurance', moon: 0.15, terms: '!health insurance, health plan, medicare' },
      { id: 'property_ins', label: 'Home & renters insurance', moon: 0.15, terms: '!home insurance, renters insurance, property insurance' },
      { id: 'embedded_ins', label: 'Embedded & specialty insurance', moon: 0.15, terms: 'embedded insurance, insurance api, pet insurance, travel insurance, gadget insurance' },
    ] },
  { id: 'adtech', label: 'Marketing & ads', sector: 'adtech_martech', moon: 0.15, related: ['saas', 'media'],
    terms: 'marketing, advertising, ads, ad, campaign',
    subs: [
      { id: 'ad_platforms', label: 'Ad platforms', moon: 0.15, terms: '!ad network, programmatic, ad exchange, targeting, retarget, ad tech, adtech' },
      { id: 'marketing_sw', label: 'Marketing software', moon: 0.1, terms: 'email marketing, marketing automation, seo, social media management, influencer marketing, inbound marketing, content marketing, !ad creative, ad copy, marketing copy, marketing content, brand content, marketer' },
    ] },
];

// Old research "sector" ids → vertical, used as a tie-breaking prior when labelling companies
export const SECTOR_TO_VERTICAL = {
  fintech: ['fintech', 'insurance'], crypto_web3: ['crypto'], ecommerce_marketplace: ['commerce'], quick_commerce_delivery: ['delivery'],
  mobility_transport: ['mobility'], proptech_realestate: ['property'], healthtech: ['health'], biotech: ['bio'], edtech: ['edtech'],
  saas_b2b: ['saas', 'work'], devtools_infra: ['devtools'], ai_ml: ['ai'], consumer_social: ['social'], media_content: ['media'],
  gaming: ['gaming'], foodtech: ['food'], hardware_iot: ['hardware', 'robotics'], climate_energy: ['climate'],
  logistics_supplychain: ['logistics'], hrtech_work: ['work'], travel_hospitality: ['travel'], legal_govtech: ['legal_gov', 'defense'],
  insurtech: ['insurance'], agritech: ['agri'], deeptech_space: ['space', 'semis', 'robotics'], security: ['security'],
  adtech_martech: ['adtech'], retail_d2c: ['commerce'], gig_services_ondemand: ['home_services'],
};

// ---- compile ----
function parseTerms(str) {
  const seen = new Map(); // after stemming, "trucking" == "truck": count each normalized term once, at its highest weight
  for (const t of parseRaw(str)) if (!seen.has(t.n) || seen.get(t.n).w < t.w) seen.set(t.n, t);
  return [...seen.values()];
}
function parseRaw(str) {
  return (str || '').split(',').map((s) => s.trim()).filter(Boolean).map((raw) => {
    let w = null, t = raw;
    if (t.startsWith('!')) { w = 4; t = t.slice(1); } else if (t.startsWith('~')) { w = 0.7; t = t.slice(1); }
    const n = tokenize(t).join(' ');
    if (!n) return null;
    // a phrase whose filler words got dropped ("plant based" → "plant") would match far too broadly: skip it
    if (t.trim().split(/[\s-]+/).length > 1 && !n.includes(' ')) return null;
    if (w === null) w = n.includes(' ') ? 3 : 2;
    return { raw: t, n, w, multi: n.includes(' ') };
  }).filter(Boolean);
}

export const V = {}, SV = {};
for (const v of TAXONOMY) {
  v.cterms = parseTerms(v.terms);
  V[v.id] = v;
  for (const s of v.subs) { s.cterms = parseTerms(s.terms); s.vertical = v.id; SV[v.id + '/' + s.id] = s; }
}

// "Uber for plumbers", "Tinder for co-founders": the famous name tells us the business model
const PATTERNS = [
  [/\btinder for\b/gi, 'matchmaking app for'], [/\buber for\b/gi, 'on demand booking of'], [/\bairbnb for\b/gi, 'peer to peer rental of'],
  [/\bnetflix for\b/gi, 'streaming subscription for'], [/\bspotify for\b/gi, 'streaming subscription for'],
  [/\bamazon for\b/gi, 'online marketplace for'], [/\bshopify for\b/gi, 'ecommerce platform for'], [/\blinkedin for\b/gi, 'professional network for'],
  [/\bstripe for\b/gi, 'payment api for'], [/\bduolingo for\b/gi, 'learning app for'], [/\bdoordash for\b/gi, 'delivery of'],
  [/\bcanva for\b/gi, 'design software for'], [/\bslack for\b/gi, 'team chat for'], [/\bfigma for\b/gi, 'design software for'],
  [/\bbloomberg terminal for\b/gi, 'market data terminal for'], [/\bopenai for\b/gi, 'foundation model for'], [/\bchatgpt for\b/gi, 'ai assistant for'],
  [/\brocket[\s-]+internet\b/gi, 'venture builder'], [/\blive (to|until|past) (1[2-9]\d|[2-9]\d\d)\b/gi, 'longevity reverse aging'],
];
export function expandPatterns(text) {
  let t = text || '';
  for (const [re, rep] of PATTERNS) t = t.replace(re, rep);
  return t;
}

// Words that say *how* it works ("an AI agent that…") rather than *what market* it serves. When a real industry is
// named ("…for accountants"), these must not drag the idea into the AI vertical.
const GENERIC_AI = new Set(['ai agent', 'agent', 'agentic', 'autonomous agent', 'copilot', 'ai assistant', 'assistant', 'personal assistant',
  'chatbot', 'ai employee', 'digital worker', 'automate task', 'operate software', 'llm', 'ai model', 'language model', 'llm app',
  'voice agent', 'ai receptionist', 'computer use', 'browser agent'].map((t) => tokenize(t).join(' ')));

// text fields: [[text, weight], ...]; prior: {verticalId: bonus}
export function classify(fields, prior = {}, subPrior = {}) {
  const normed = fields.map(([t, w]) => [norm(expandPatterns(t)), w]);
  const hit = (term) => {
    let best = 0;
    for (const [n, w] of normed) if (w > best && (n.includes(' ' + term.n + ' '))) best = w;
    return best;
  };
  const vScores = {}, svScores = [], matched = [];
  for (const v of TAXONOMY) {
    let vs = prior[v.id] || 0;
    for (const t of v.cterms) { const h = hit(t); if (h) { vs += t.w * h * 0.6; matched.push({ term: t.raw, w: t.w * h, v: v.id }); } }
    let best = null;
    for (const s of v.subs) {
      let ss = subPrior[v.id + '/' + s.id] || 0; const terms = ss ? ['(like a company you named)'] : [];
      let spec = ss; // score from words that name a market, not just "it's an AI agent"
      for (const t of s.cterms) { const h = hit(t); if (h) { ss += t.w * h; if (!GENERIC_AI.has(t.n)) spec += t.w * h; if (t.w >= 2) terms.push(t.raw); } }
      if (ss > 0) {
        svScores.push({ v: v.id, sv: s.id, score: ss + vs * 0.5, spec, terms });
        if (!best || ss > best) best = ss;
      }
    }
    vScores[v.id] = vs + (best || 0);
  }
  // "AI" and "marketplace" are often modifiers ("AI for lawyers"): when a domain vertical is clearly present, let it lead
  const domainTop = Math.max(0, ...Object.entries(vScores).filter(([k]) => k !== 'ai').map(([, s]) => s));
  if (vScores.ai && domainTop >= 3.5 && !svScores.some((x) => x.v === 'ai' && x.spec >= 6)) {
    const aiSpec = Math.max(0, ...svScores.filter((x) => x.v === 'ai').map((x) => x.spec));
    vScores.ai = Math.min(vScores.ai * 0.55, aiSpec + 0.5 * (vScores.ai - aiSpec) * 0.55); // generic AI words count for little next to a named market
  }
  const rankedV = Object.entries(vScores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  svScores.sort((a, b) => (vScores[b.v] - vScores[a.v]) * 0.25 + (b.score - a.score));
  const vertical = rankedV.length ? rankedV[0][0] : null;
  const inV = svScores.filter((x) => x.v === vertical).sort((a, b) => b.score - a.score);
  const top = inV[0] || null;
  // a strong sub-vertical in another vertical (e.g. "satellite imagery for insurers")
  const second = svScores.filter((x) => x !== top).sort((a, b) => b.score - a.score)[0] || null;
  return {
    vertical, subvertical: top ? top.sv : null, score: rankedV.length ? rankedV[0][1] : 0,
    rankedV, subs: svScores.sort((a, b) => b.score - a.score).slice(0, 5),
    second: second && top && second.score >= 0.75 * top.score ? second : null,
    terms: top ? top.terms : [],
  };
}

export function businessFlags(text) {
  const n = norm(text);
  const has = (list) => list.some((w) => n.includes(' ' + tokenize(w).join(' ') + ' '));
  return {
    hardware: has(['device', 'hardware', 'robot', 'chip', 'sensor', 'gadget', 'wearable', 'vehicle', 'rocket', 'satellite', 'reactor', 'machine', 'drone', 'battery', 'factory', 'manufactur']),
    b2b: has(['business', 'enterprise', 'b2b', 'smb', 'companies', 'team', 'merchant', 'hospital', 'retailer', 'restaurant', 'factory', 'warehouse', 'brand', 'manufacturer', 'carmaker', 'oem']),
    b2c: has(['consumer', 'families', 'kid', 'student', 'individual', 'personal', 'yourself', 'parent', 'traveler', 'shopper']),
    lowCost: has(['cheap', 'affordable', 'low cost', 'budget', 'inexpensive', 'fraction of the cost', 'cheaper']),
  };
}

export function label(v, sv) {
  const vv = V[v];
  if (!vv) return v || '';
  const s = sv && SV[v + '/' + sv];
  return s ? `${vv.label} › ${s.label}` : vv.label;
}
