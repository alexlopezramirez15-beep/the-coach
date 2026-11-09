/* THE COACH — Textos generados: historia de cada club (~1500 palabras) y descripción de cada jugador (~700).
 * Son deterministas (misma semilla, mismo texto) y se construyen a partir de los datos reales de la plantilla:
 * las fortalezas, debilidades, amenazas y oportunidades que el alumno debe detectar están "escondidas" en el relato,
 * nunca etiquetadas como tales. */
(function (G) {
  'use strict';
  const TC = G.TC;
  const rng = (seed) => TC.makeRng('story:' + seed);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ───── Utilidades de datos ───── */
  const LINE_NAME = { gk: 'portería', def: 'línea defensiva', mid: 'línea de medios', att: 'línea de ataque' };
  function cityOf(team) { return team.name.replace(/^(CF|UD|CD|SD|CE|Racing|Atlètic|Atlético|Deportivo|Unión|Club)\s+/i, '').trim() || team.name; }
  function colorName(hex) {
    const NAMES = [['verde', [47, 191, 113]], ['azul', [59, 130, 246]], ['amarillo', [245, 158, 11]], ['rojo', [239, 68, 68]], ['morado', [168, 85, 247]], ['turquesa', [20, 184, 166]], ['naranja', [249, 115, 22]], ['granate', [225, 29, 72]], ['verde lima', [132, 204, 22]], ['celeste', [6, 182, 212]], ['oro', [234, 179, 8]], ['violeta', [139, 92, 246]], ['esmeralda', [16, 185, 129]], ['carmesí', [244, 63, 94]], ['azul cielo', [14, 165, 233]], ['fucsia', [217, 70, 239]], ['blanco', [255, 255, 255]], ['azul marino', [15, 42, 74]], ['negro', [17, 24, 39]]];
    const h = String(hex || '').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    let best = NAMES[0], bd = 1e9; for (const x of NAMES) { const d = x[1].reduce((s, v, i) => s + (v - rgb[i]) ** 2, 0); if (d < bd) { bd = d; best = x; } }
    return best[0];
  }
  const lineAvg = (players, line) => { const ps = players.filter((p) => TC.POSITIONS[p.pos].line === line); return ps.length ? Math.round(TC.avg(ps.map((p) => TC.playerRating(p)))) : 0; };
  const groupAvg = (p, g) => Math.round(TC.avg(TC.ATTR_GROUPS[g].attrs.map((a) => p.attrs[a[0]])));
  const fmtList = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]);

  function squadFacts(team) {
    const ps = team.players;
    const lines = ['def', 'mid', 'att'].map((l) => [l, lineAvg(ps, l)]).sort((a, b) => b[1] - a[1]);
    const byRating = ps.slice().sort((a, b) => TC.playerRating(b) - TC.playerRating(a));
    const young = ps.filter((p) => p.age <= 20).sort((a, b) => TC.playerRating(b) - TC.playerRating(a));
    const vets = ps.filter((p) => p.age >= 30).sort((a, b) => b.age - a.age);
    const groups = Object.keys(TC.ATTR_GROUPS).map((g) => [g, Math.round(TC.avg(ps.filter((p) => p.pos !== 'POR').map((p) => groupAvg(p, g))))]).sort((a, b) => b[1] - a[1]);
    const sp = TC.squadSpaces(ps);
    const spaces = Object.entries(sp).sort((a, b) => b[1].value - a[1].value);
    return { lines, best: byRating.slice(0, 3), young, vets, groups, spaces, avgAge: Math.round(TC.avg(ps.map((p) => p.age)) * 10) / 10 };
  }
  const GROUP_HUMAN = { tecnicos: 'el trato de balón', tacticos: 'la lectura del juego', fisicos: 'el despliegue físico', psicologicos: 'el carácter competitivo' };

  /* ───── Historia del club ───── */
  function clubHistory(team, comp) {
    const r = rng('club:' + team.id);
    const city = cityOf(team);
    const spec = G.TCArt ? G.TCArt.crestSpec(team) : { founded: 1920, second: '#ffffff' };
    const founded = spec.founded;
    const c1 = colorName(team.color), c2 = colorName(spec.second);
    const F = ['Ramón', 'Joaquín', 'Esteban', 'Manuel', 'Josep', 'Andrés', 'Tomás', 'Luis', 'Ernesto', 'Francisco', 'Vicente', 'Gregorio', 'Salvador', 'Julián'];
    const L = ['Albors', 'Mendívil', 'Sanchís', 'Echevarría', 'Llorens', 'Barrachina', 'Quiles', 'Ugarte', 'Peris', 'Goikoetxea', 'Montesinos', 'Climent', 'Arrieta', 'Torralba'];
    const person = () => r.pick(F) + ' ' + r.pick(L);
    const founder = person(), legend1 = person(), legend2 = person(), coachGold = person(), president = person();
    const stadium = r.pick(['Estadio Municipal de ', 'Campo de ', 'Estadio ', 'Ciudad Deportiva de ']) + r.pick(['La Vega', 'Los Almendros', 'El Ejido', 'San Roque', 'La Florida', 'El Prado', 'Las Moreras', 'Santa Ana']);
    const capacity = r.int(4, 18) * 500;
    const nick = r.pick(['los ' + c1 + 's', 'el equipo del barrio', 'los de ' + city, 'el ' + c1 + 'illo', 'los obreros', 'los albañiles', 'los del río']);
    const goldStart = founded + r.int(40, 70), goldEnd = goldStart + r.int(4, 9);
    const crisisYear = goldEnd + r.int(6, 18);
    const rival = comp ? (G.TCStore ? G.TCStore.teamsOf(comp.id).filter((t) => t.id !== team.id) : [])[0] : null;
    const rivalName = rival ? rival.name : 'el vecino del otro lado del río';
    const f = squadFacts(team);
    const [bestLine, , worstLine] = f.lines;
    const titles = r.int(1, 3);
    const P = [];

    P.push(`## Orígenes (${founded})\n${team.name} nació en ${founded}, en la trastienda de una ferretería del centro de ${city}, cuando ${founder} y un grupo de trabajadores de la fábrica textil decidieron que la ciudad necesitaba algo más que el paseo del domingo. Jugaban en un descampado junto a la vía del tren, con porterías de madera que ellos mismos clavaban cada sábado y que desmontaban por la noche para que no se las llevaran. Las primeras camisetas, ${c1}s con detalles en ${c2}, se tiñeron en un barreño porque no había dinero para comprarlas hechas, y esos colores no han cambiado desde entonces. El acta fundacional, que se conserva enmarcada en las oficinas del club, habla de "fomentar el deporte, la amistad y el buen nombre de ${city}". Aquella frase, escrita a mano y con alguna falta de ortografía, todavía se lee en voz alta cada vez que un jugador nuevo firma su primera ficha.`);

    P.push(`## Los primeros años\nDurante las primeras décadas ${team.name} fue un club modesto, de categorías regionales, que se sostenía con las cuotas de los socios y con la rifa de un jamón por Navidad. ${r.pick(['La afición recuerda', 'Los más mayores todavía cuentan', 'En la ciudad se sigue contando'])} que el equipo viajaba en el camión de una cooperativa agrícola y que, más de una vez, los jugadores tuvieron que empujarlo cuesta arriba para llegar a tiempo al partido. Aquellos años forjaron una manera de entender el fútbol: equipos trabajadores, solidarios, que compensaban la falta de talento con orden y esfuerzo. El apodo de "${nick}" nació entonces, en la crónica de un periódico local que quiso burlarse del equipo y terminó regalándole una identidad. Hoy la grada lo canta con orgullo, y muchos de los niños de la escuela lo llevan escrito en la espalda.`);

    P.push(`## El estadio y la ciudad\nEn ${founded + r.int(25, 45)} el club se trasladó al ${stadium}, con capacidad para unas ${capacity.toLocaleString('es-ES')} personas, construido en parte con el trabajo voluntario de los socios. La tribuna principal, de hormigón y con una cubierta que cruje cuando sopla el viento, es la misma desde entonces; el resto del campo se ha ido renovando por fases, la última hace apenas unos años, cuando se instaló césped híbrido y se mejoró el drenaje. El estadio está a diez minutos andando de la plaza mayor y los días de partido el barrio cambia: los bares sacan las mesas a la calle, las peñas cuelgan bufandas en los balcones y los chavales de la escuela hacen de recogepelotas. ${team.name} no es solo un equipo; es uno de los pocos lugares donde se encuentran tres generaciones de ${city}.`);

    P.push(`## La época dorada (${goldStart}-${goldEnd})\nEl momento más brillante de la historia llegó entre ${goldStart} y ${goldEnd}, con ${coachGold} en el banquillo. Fue un entrenador adelantado a su tiempo: hablaba de "defender hacia delante" y de "jugar con los espacios" cuando en la categoría casi todo el mundo se limitaba a pegar patadones. Con él, ${team.name} consiguió ${titles === 1 ? 'su único ascenso de categoría' : titles + ' ascensos en siete temporadas'} y llegó a jugar una eliminatoria de copa contra un equipo profesional que todavía se recuerda como "la noche del ${stadium.split(' ').pop()}". Aquel equipo tenía dos referentes: ${legend1}, un mediocentro que "veía el pase antes de recibir", y ${legend2}, un delantero rápido que marcó más de cien goles con la camiseta ${c1}. Sus fotografías presiden el vestuario, y sus nombres se usan todavía como ejemplo cuando se explica a los jóvenes qué significa jugar en este club.`);

    P.push(`## Crisis y reconstrucción\nNo todo fue bonito. En ${crisisYear} una mala gestión económica, unida a dos descensos seguidos, dejó al club al borde de la desaparición. Hubo meses sin cobrar, jugadores que se marcharon a mitad de temporada y una asamblea tensa en la que se llegó a votar la disolución. Fue la afición la que salvó a ${team.name}: una campaña popular de "un socio, un ladrillo" recaudó lo suficiente para pagar las deudas más urgentes, y un grupo de antiguos jugadores asumió la directiva sin cobrar nada. De aquella etapa quedó una lección que el club repite como un mantra: no gastar lo que no se tiene, apostar por la cantera y construir equipos con jugadores que entiendan lo que significa la camiseta. ${president}, presidente actual, fue uno de los jóvenes que debutaron precisamente en aquellos años difíciles.`);

    P.push(`## La cantera\nLa escuela de ${team.name} es hoy el orgullo de la entidad. Más de veinte equipos, desde prebenjamines hasta juveniles, entrenan cada tarde en los campos anexos al estadio. La metodología de la cantera intenta ser coherente de arriba abajo: se trabaja por principios de juego, se prioriza la toma de decisiones sobre el resultado y se pide a los entrenadores que diseñen las tareas pensando en lo que el primer equipo necesitará dentro de unos años. ${f.young.length ? `Varios jugadores de la plantilla actual salieron de aquí; el caso más llamativo es el de ${f.young[0].name}, que con ${f.young[0].age} años ya entrena con el primer equipo y del que se habla mucho en la ciudad.` : 'En los últimos años, sin embargo, la cantera no ha conseguido colocar jugadores en el primer equipo, y esa es una de las preocupaciones de la directiva.'} La directiva insiste en que el nuevo cuerpo técnico debe dar minutos a los jóvenes siempre que estén preparados, pero sin regalarles nada.`);

    P.push(`## Afición, identidad y rivalidad\nLa afición de ${team.name} es exigente, pero leal. No perdona la falta de esfuerzo y aplaude al jugador que corre hacia atrás para recuperar un balón tanto como al que marca un gol. Hay cinco peñas oficiales y una grada de animación joven que lleva tambores y bengalas de humo ${c1}. El partido más esperado del año es el derbi contra ${rivalName}: dos formas de entender el fútbol y dos barrios que se miran de reojo durante toda la semana. En la ciudad se dice que "una temporada puede salvarse con un derbi", y no es del todo una broma. La identidad del club se resume en tres palabras que aparecen pintadas en el túnel de vestuarios: esfuerzo, orden y valentía. Cualquier modelo de juego que quiera triunfar aquí tiene que respetarlas.`);

    const pos = r.int(5, 13), coachOut = person();
    P.push(`## La temporada pasada\nEl curso anterior fue irregular. ${team.name} terminó en la ${pos}.ª posición, lejos de los puestos de arriba pero sin pasar apuros reales para mantener la categoría. El equipo empezó bien, con cuatro victorias en las seis primeras jornadas, pero en noviembre llegó una racha de ocho partidos sin ganar que le costó el puesto al entrenador, ${coachOut}. Su sustituto, un interino de la casa, recuperó la confianza del grupo, aunque el equipo nunca terminó de tener una idea clara: alternaba partidos de mucha posesión con otros en los que se limitaba a defender y salir a la contra. Los números lo reflejan: ${f.lines[0][0] === 'def' ? 'fue una de las defensas menos goleadas, pero le costó muchísimo generar ocasiones' : f.lines[0][0] === 'att' ? 'marcó muchos goles, pero concedió demasiados, sobre todo en transiciones' : 'dominó muchos partidos desde el centro del campo, pero le faltó profundidad y pegada en el último tercio'}. En la ciudad se habló mucho de la falta de un plan reconocible y de que varios jugadores rindieron por debajo de lo esperado porque "no se les pedía lo que saben hacer". Ese diagnóstico pesa en la elección del nuevo entrenador.`);

    P.push(`## La plantilla actual\nEl equipo que hereda el nuevo cuerpo técnico tiene una media de edad de ${String(f.avgAge).replace('.', ',')} años. Los informes internos coinciden en que su mayor virtud colectiva es ${GROUP_HUMAN[f.groups[0][0]]}, mientras que ${GROUP_HUMAN[f.groups[f.groups.length - 1][0]]} es lo que más ha costado en las últimas temporadas. Por líneas, la ${LINE_NAME[bestLine[0]]} es la que transmite más seguridad, y en el club hay dudas sobre la ${LINE_NAME[worstLine[0]]}, que "necesita ayuda" según la secretaría técnica. ${f.best.length ? `Los nombres propios son ${fmtList(f.best.map((p) => p.name + ' (' + TC.POSITIONS[p.pos].label.toLowerCase() + ')'))}: alrededor de ellos se espera construir el equipo.` : ''} ${f.vets.length ? `En el vestuario pesan mucho los veteranos, sobre todo ${fmtList(f.vets.slice(0, 2).map((p) => p.name + ', de ' + p.age + ' años'))}, aunque el paso del tiempo empieza a notarse.` : 'Apenas hay veteranos, y algunos aficionados echan de menos voces de experiencia en el vestuario.'} Si se analiza la plantilla con el marco de los espacios de fase, destaca en ${TC.PHASE_SPACES[f.spaces[0][0]].label.toLowerCase()} y anda más justa en ${TC.PHASE_SPACES[f.spaces[f.spaces.length - 1][0]].label.toLowerCase()}.`);

    P.push(`## Lo que el club espera del nuevo entrenador\nLa directiva ha sido clara en la presentación: no se exige un ascenso inmediato, pero sí un equipo reconocible, que compita cada fin de semana y que haga crecer a los jugadores. El presupuesto es ajustado y no habrá fichajes hasta el mercado de invierno, de modo que el entrenador tendrá que sacar el máximo de los dieciocho futbolistas disponibles. Se valorará especialmente que el modelo de juego se adapte a las características reales de la plantilla y no al revés, que las sesiones de entrenamiento tengan un sentido claro y que las decisiones se puedan explicar. "Queremos un entrenador que piense", dijo ${president} el día de la presentación. "Que mire a sus jugadores, entienda lo que pueden dar y los ponga en situación de hacerlo bien". El reto empieza ahora: conocer a cada jugador, detectar sus fortalezas y sus límites, y convertir ese conocimiento en una idea de juego.`);

    return P.join('\n\n');
  }

  /* ───── Frases por atributo (sin números: el alumno debe interpretarlas) ───── */
  const HI = {
    pase: 'Su pase es limpio y tenso; encuentra compañeros a veinte o treinta metros sin que el balón bote y rara vez regala una posesión cuando el equipo intenta salir jugando.',
    control: 'Controla balones difíciles con una facilidad que sorprende: orientados, con el exterior o de espaldas, el balón se queda pegado a su bota incluso con un rival encima.',
    conduccion: 'Cuando encuentra espacio por delante conduce con la cabeza levantada y el balón cerca, y es capaz de atravesar media cancha para fijar a un rival y soltar en el momento justo.',
    regate: 'En el uno contra uno es un problema para cualquiera: cambia de ritmo, amaga hacia dentro y sale por fuera, y los defensores suelen recibir tarjeta intentando pararle.',
    finalizacion: 'Delante de la portería tiene sangre fría; define con las dos piernas, elige bien entre potencia y colocación, y en los entrenamientos de finalización es de los que más acierta.',
    aereo: 'Gana muchísimos duelos por arriba: calcula muy bien la trayectoria, salta antes que el rival y cabecea con dirección, tanto en su área como en la contraria.',
    entrada: 'Es un especialista en el robo: mete el pie en el momento exacto, casi siempre limpio, y deja a los atacantes sin balón sin necesidad de cometer falta.',
    perfil: 'Recibe siempre perfilado, con el cuerpo abierto hacia el campo, lo que le permite jugar hacia delante a un toque y ahorrarle segundos al equipo.',
    espacios: 'Interpreta muy bien dónde está el espacio libre: aparece entre líneas o a la espalda de los defensas justo cuando el poseedor puede encontrarle.',
    decisiones: 'Toma buenas decisiones casi siempre: sabe cuándo acelerar y cuándo pausar, cuándo arriesgar el pase y cuándo asegurar, y sus entrenadores destacan que "entiende el juego".',
    orientacion: 'Su orientación corporal es de manual; antes de recibir ya ha mirado y colocado el cuerpo, y por eso casi nunca le pillan de espaldas.',
    percepcion: 'Escanea el campo constantemente; gira la cabeza antes de cada recepción y tiene en la cabeza dónde están compañeros y rivales.',
    anticipacion: 'Se anticipa a las intenciones del rival y corta pases antes de que lleguen a su destino; muchas de sus recuperaciones parecen fáciles porque llega antes que nadie.',
    ocupacion: 'Ocupa siempre el espacio que le corresponde, mantiene distancias con sus compañeros y da equilibrio sin que se note; el equipo se ordena mejor cuando él está en el campo.',
    asociacion: 'Le encanta asociarse en corto: paredes, apoyos de cara y juego de tercer hombre le salen de forma natural, y conecta con facilidad con los jugadores más técnicos.',
    intDefensiva: 'Defensivamente lee muy bien las situaciones: sabe cuándo salir, cuándo temporizar y cuándo cubrir a un compañero, y apenas comete errores de colocación.',
    superioridad: 'Tiene una habilidad especial para generar ventajas: atrae a dos rivales, rompe líneas y deja a un compañero solo, o gana el duelo y crea la superioridad él mismo.',
    velocidad: 'Es muy rápido en distancias largas; si se le da espacio a la espalda de la defensa rival, pocos le alcanzan.',
    aceleracion: 'Su arrancada es explosiva: en los primeros cinco metros saca ventaja a casi cualquiera, algo que se nota en desmarques de ruptura y en las ayudas defensivas.',
    resistencia: 'Termina los partidos con la misma intensidad con la que los empieza; los datos de GPS le sitúan siempre entre los que más distancia recorren.',
    fuerza: 'Es un jugador fuerte, difícil de desplazar en el cuerpo a cuerpo, que protege muy bien el balón y gana muchos choques.',
    agilidad: 'Es ágil y coordinado: cambia de dirección con rapidez y se levanta enseguida tras un contacto.',
    repetir: 'Puede repetir esfuerzos de alta intensidad una y otra vez sin bajar el nivel, ideal para presionar y volver a presionar.',
    concentracion: 'Mantiene la concentración los noventa minutos; es raro verle desconectado en una jugada a balón parado o en los minutos finales.',
    confianzaAttr: 'Juega con mucha confianza: pide el balón en momentos difíciles, no se esconde tras un error y transmite seguridad a los que le rodean.',
    competitividad: 'Es un competidor nato; odia perder hasta en los rondos y contagia esa intensidad a los compañeros en los entrenamientos.',
    adaptacion: 'Se adapta muy rápido a lo que se le pide: ha jugado en sistemas distintos y asimila los cambios tácticos sin problemas.',
    colectivo: 'Es un jugador de equipo: hace el trabajo sucio, cubre a los compañeros y celebra los goles de los demás como propios.',
  };
  const LO = {
    pase: 'Con el pase largo sufre: cuando tiene que cambiar el juego o filtrar un balón entre líneas, el envío suele salir corto o demasiado fuerte.',
    control: 'Su primer control no siempre es limpio; bajo presión el balón se le separa del pie y el rival aprovecha para robar.',
    conduccion: 'Cuando tiene que conducir con espacio por delante tiende a perder el balón o a tardar en soltarlo.',
    regate: 'No es un jugador de uno contra uno; cuando se queda encarado con un rival prefiere devolver el balón atrás.',
    finalizacion: 'Le cuesta finalizar: en las ocasiones claras suele precipitarse o elegir mal el tipo de golpeo.',
    aereo: 'Por arriba sufre bastante; en los centros laterales y en los saques de esquina los rivales le ganan la posición con frecuencia.',
    entrada: 'En el duelo defensivo llega tarde o va al suelo antes de tiempo, y eso le cuesta faltas en zonas peligrosas.',
    perfil: 'Muchas veces recibe con el cuerpo cerrado, de espaldas al juego, y eso le obliga a dar un toque de más antes de poder girarse.',
    espacios: 'A veces no encuentra su sitio: se queda en zonas donde el compañero no puede darle el balón o pisa el mismo espacio que otro.',
    decisiones: 'Su toma de decisiones es irregular: alterna acciones muy buenas con otras precipitadas, especialmente cuando el partido se acelera.',
    orientacion: 'Suele colocarse mal antes de recibir, lo que le obliga a jugar hacia atrás aunque haya opciones hacia delante.',
    percepcion: 'Mira poco antes de recibir; muchas pérdidas llegan porque no ha visto venir al rival que le presiona por la espalda.',
    anticipacion: 'Reacciona más que anticipa: llega a los balones divididos un instante tarde.',
    ocupacion: 'Le cuesta mantener la posición; cuando el balón está lejos tiende a desordenarse y deja espacios a su espalda.',
    asociacion: 'No le resulta natural el juego de combinación corta; tiende a jugar solo y no siempre ve al compañero libre.',
    intDefensiva: 'Defensivamente comete errores de lectura: sale cuando debería quedarse o persigue al rival hasta zonas que no le corresponden.',
    superioridad: 'Rara vez genera ventajas por sí mismo; necesita que el equipo le dé el balón en condiciones favorables.',
    velocidad: 'No es rápido: en carreras largas o defendiendo a la espalda los rivales más veloces le ganan la partida.',
    aceleracion: 'Su arrancada es lenta; en los primeros metros pierde muchos duelos de velocidad.',
    resistencia: 'En los últimos veinte minutos se nota que le falta fondo: llega tarde a las ayudas y baja el ritmo.',
    fuerza: 'En el cuerpo a cuerpo sale perdiendo; los rivales más fuertes le desplazan con facilidad.',
    agilidad: 'Le cuestan los cambios de dirección rápidos y los giros en espacios reducidos.',
    repetir: 'Tras dos o tres esfuerzos seguidos de alta intensidad necesita recuperarse, y eso se nota en las fases de presión.',
    concentracion: 'Tiene desconexiones: en algún partido ha perdido la marca en un balón parado o se ha despistado en los minutos finales.',
    confianzaAttr: 'Cuando las cosas salen mal le afecta mucho; tras un error se esconde y deja de pedir el balón.',
    competitividad: 'En el club algunos le piden "un punto más de rabia": a veces da la impresión de conformarse.',
    adaptacion: 'Le cuesta adaptarse a cambios: cuando se modifica el sistema o su rol tarda varias semanas en encontrarse.',
    colectivo: 'Es bastante individualista; no siempre hace el esfuerzo defensivo que el equipo necesita.',
  };
  const TOWNS = ['un pueblo de la sierra', 'un barrio obrero de la periferia', 'una pequeña localidad costera', 'el mismo barrio del estadio', 'una ciudad dormitorio cercana', 'un pueblo agrícola de la comarca', 'otra comunidad autónoma'];

  function playerStory(p, team) {
    const r = rng('player:' + p.id);
    const pos = TC.POSITIONS[p.pos].label.toLowerCase();
    const list = TC.ALL_ATTRS.map((a) => [a, p.attrs[a]]).sort((a, b) => b[1] - a[1]);
    const top = list.slice(0, 4).map((x) => x[0]);
    const low = list.slice(-3).map((x) => x[0]).reverse();
    const rating = TC.playerRating(p);
    const mates = team ? team.players.filter((q) => q.id !== p.id && q.pos === p.pos) : [];
    const better = mates.filter((q) => TC.playerRating(q) > rating).sort((a, b) => TC.playerRating(b) - TC.playerRating(a))[0];
    const worse = mates.filter((q) => TC.playerRating(q) <= rating)[0];
    const contract = r.int(0, 3);
    const injuries = r() < 0.32 ? r.pick(['una rotura muscular en el isquiotibial la temporada pasada que le tuvo seis semanas fuera', 'un esguince de tobillo que se ha repetido dos veces en el último año', 'molestias recurrentes en la rodilla que obligan a dosificar su carga semanal', 'una pubalgia que arrastró durante meses y que todavía le molesta en semanas de mucha carga']) : null;
    const interest = r() < 0.28 ? r.pick(['un club de categoría superior ha preguntado por él', 'se rumorea que un equipo de la zona le ha ofrecido un contrato mejor', 'su representante ha dejado caer que quiere jugar más minutos o saldrá en invierno']) : null;
    const seasons = Math.max(0, Math.min(p.age - 17, r.int(0, 6)));
    const fromAcademy = p.age <= 21 || r() < 0.3;
    const name = p.name.split(' ')[0];
    const P = [];

    P.push(`## Trayectoria\n${p.name} tiene ${p.age} años y juega de ${pos}${p.sec.length ? ', aunque también puede actuar como ' + fmtList(p.sec.map((s) => TC.POSITIONS[s].label.toLowerCase())) : ''}. Nació en ${r.pick(TOWNS)} y ${fromAcademy ? `llegó a la escuela de ${team ? team.name : 'el club'} siendo un niño; ha pasado por todas las categorías inferiores hasta asentarse en el primer equipo` : `llegó a ${team ? team.name : 'el club'} hace ${seasons ? seasons + (seasons === 1 ? ' temporada' : ' temporadas') : 'apenas unos meses'} procedente de ${r.pick(['un equipo de la misma categoría', 'un filial de un club profesional', 'un modesto de regional', 'un club de otra comunidad'])}`}. Mide ${p.height} cm, es de pierna ${p.foot === 'Ambas' ? 'ambidiestro y golpea con las dos con naturalidad' : p.foot.toLowerCase()}, y en el vestuario le definen como un ${p.profile.toLowerCase()}. ${p.age <= 21 ? 'Es uno de los jugadores más jóvenes de la plantilla y todavía está en pleno proceso de formación: cada temporada se nota un salto en su juego.' : p.age >= 30 ? 'Es uno de los veteranos del grupo; su experiencia se valora mucho, aunque en el cuerpo técnico vigilan cómo responde su físico a las semanas de mucha carga.' : 'Está en una edad en la que se espera de él regularidad y madurez competitiva.'}`);

    P.push(`## Lo que aporta en el campo\n${HI[top[0]]} ${HI[top[1]]} ${r.pick(['Además,', 'A eso se suma que', 'También destaca porque'])} ${HI[top[2]].charAt(0).toLowerCase() + HI[top[2]].slice(1)} ${HI[top[3]]} ${r.pick([`Los entrenadores que le han tenido coinciden en que, bien utilizado, puede ser una pieza importante.`, `En los vídeos de la temporada pasada se aprecian muchas acciones de este tipo.`, `Quien le vea entrenar una semana lo nota enseguida.`])}`);

    P.push(`## Lo que le cuesta\n${r.pick(['No todo es perfecto.', 'También tiene aspectos que mejorar.', 'Hay facetas en las que sufre.'])} ${LO[low[0]]} ${LO[low[1]]} ${LO[low[2]]} ${r.pick([`Un rival que le conozca puede intentar aprovecharlo.`, `Son cosas que se pueden trabajar, pero no de un día para otro.`, `El cuerpo técnico anterior lo tenía apuntado en su informe.`])}`);

    const psy = TC.ATTR_GROUPS.psicologicos.attrs.map((a) => [a[0], p.attrs[a[0]]]).sort((a, b) => b[1] - a[1]);
    P.push(`## Carácter y vestuario\n${name} ${r.pick(['es un chico tranquilo fuera del campo', 'es de los que más hablan en el vestuario', 'es reservado, pero muy respetado', 'es uno de los animadores del grupo'])}. ${psy[0][1] >= 60 ? HI[psy[0][0]] : 'En lo mental está en la media del grupo, sin rasgos que destaquen especialmente.'} ${psy[psy.length - 1][1] < 52 ? LO[psy[psy.length - 1][0]] : 'Mentalmente es estable y no suele dar problemas.'} ${p.age >= 29 && psy[0][1] >= 60 ? 'Varios compañeros le ven como un referente y no sería extraño que llevara el brazalete en algún partido.' : ''}`);

    // Perfil por bloques comparado con el resto de la plantilla
    const teamAvg = (g) => (team ? Math.round(TC.avg(team.players.filter((q) => q.pos !== 'POR' || p.pos === 'POR').map((q) => groupAvg(q, g)))) : 55);
    const cmp = (g) => { const d = groupAvg(p, g) - teamAvg(g); return d >= 5 ? 'claramente por encima de la media del equipo' : d >= 2 ? 'algo por encima de la media del equipo' : d <= -5 ? 'claramente por debajo de la media del equipo' : d <= -2 ? 'algo por debajo de la media del equipo' : 'en la media del equipo'; };
    P.push(`## Perfil técnico, táctico, físico y psicológico\nSi se compara con el resto de la plantilla, en lo técnico está ${cmp('tecnicos')}; en lo táctico, ${cmp('tacticos')}; en lo físico, ${cmp('fisicos')}; y en lo psicológico, ${cmp('psicologicos')}. ${groupAvg(p, 'fisicos') > groupAvg(p, 'tecnicos') + 4 ? 'Es, por tanto, un futbolista que se apoya más en sus condiciones físicas que en su técnica, y eso condiciona el tipo de tareas en las que más rinde.' : groupAvg(p, 'tecnicos') > groupAvg(p, 'fisicos') + 4 ? 'Es, por tanto, un futbolista que se apoya más en su técnica que en el físico; en partidos muy disputados y de ida y vuelta puede pasarlo peor.' : 'Es un perfil bastante equilibrado entre lo técnico y lo físico.'} Los datos de los últimos test de pretemporada están en su ficha, pero el cuerpo técnico insiste en que los números hay que leerlos en contexto: un jugador no es solo una lista de atributos, sino lo que es capaz de hacer dentro de un sistema y con unos compañeros concretos.`);

    const sv = Object.keys(TC.PHASE_SPACES).map((k) => [k, TC.spaceValue(p, k)]).sort((a, b) => b[1] - a[1]);
    const SP_TXT = { intervencion: 'las acciones individuales con balón y en el duelo, donde decide él solo', ayuda: 'las acciones con uno o dos compañeros cercanos (apoyos, paredes, coberturas)', cooperacion: 'las acciones colectivas de todo el bloque, donde lo importante es ocupar bien los espacios y moverse a la vez que el equipo' };
    P.push(`## Encaje en un modelo de juego\nPensando en los espacios de fase, se siente más cómodo en ${SP_TXT[sv[0][0]]}, y le cuesta más en ${SP_TXT[sv[sv.length - 1][0]]}. ${r.pick([`En un partido de la temporada pasada se vio con claridad:`, `Hay una jugada que lo resume bien:`, `Un ejemplo típico:`])} ${{ intervencion: `cuando recibió aislado en banda frente a un solo rival, resolvió con ventaja y el equipo pudo progresar; en cambio, cuando el equipo necesitó que mantuviera la posición y esperara, se precipitó.`, ayuda: `cuando tuvo un compañero cerca para combinar, el balón salió limpio y el equipo ganó metros; cuando le tocó resolver solo ante la presión, la jugada se complicó.`, cooperacion: `cuando el bloque estuvo junto y bien escalonado, apenas se le vio fallar; cuando el partido se rompió y hubo que ganar duelos individuales, sufrió más.` }[sv[0][0]]} Un modelo que le ponga en situaciones parecidas a esas sacará lo mejor de él; uno que le obligue continuamente a lo contrario puede convertir sus límites en un problema para todo el equipo.`);

    const ctx = [];
    if (better) ctx.push(`En su puesto compite con ${better.name}, que ahora mismo parte por delante en la consideración del club, así que tendrá que ganarse los minutos en cada entrenamiento.`);
    else if (worse) ctx.push(`En su puesto, la alternativa es ${worse.name}, que todavía está un escalón por detrás; si ${name} se lesionara, el equipo perdería bastante nivel en esa posición.`);
    else ctx.push(`No tiene un sustituto natural en su posición dentro de la plantilla, lo que le da muchos minutos asegurados, pero también obliga a cuidarle.`);
    if (p.sec.length) ctx.push(`Que pueda jugar también como ${TC.POSITIONS[p.sec[0]].label.toLowerCase()} abre puertas: algunos sistemas le permitirían aparecer en zonas donde ahora el equipo anda más corto.`);
    if (injuries) ctx.push(`Su historial médico incluye ${injuries}.`);
    if (contract === 0) ctx.push(`Termina contrato al final de esta temporada y todavía no ha renovado.`);
    else if (contract >= 2) ctx.push(`Tiene contrato para ${contract + 1} temporadas más, de modo que el club puede planificar a medio plazo con él.`);
    if (interest) ctx.push(`Además, ${interest}.`);
    if (p.age <= 21) ctx.push(`Por edad, su margen de mejora es grande si recibe minutos y un entrenamiento adecuado.`);
    if (p.age >= 31) ctx.push(`Por edad, es posible que su rendimiento físico empiece a bajar, sobre todo en semanas con dos partidos.`);
    if (p.fatigue >= 8) ctx.push(`Llega a la pretemporada con algo de fatiga acumulada.`);
    P.push(`## Situación actual\n${ctx.join(' ')}`);

    P.push(`## Lo que dicen de él\n"${r.pick([`${name} es de esos jugadores que te hacen mejor entrenador si sabes dónde ponerlo`, `Si le pides lo que sabe hacer, te lo da; si le pides lo que no sabe hacer, sufre`, `Tiene cosas que no se enseñan, pero también otras que tiene que pulir`, `Es un jugador que necesita confianza y un rol claro`])}", comenta un miembro del cuerpo técnico anterior. ${r.pick(['La afición le tiene cariño', 'Parte de la afición todavía duda de él', 'En la grada le han pedido más regularidad'])}, y el nuevo entrenador tendrá que decidir qué papel le reserva en su modelo de juego. Antes de hacerlo, conviene repasar con calma qué le hace fuerte, qué le limita, qué riesgos le rodean y qué oportunidades puede aprovechar.`);
    return P.join('\n\n');
  }

  // Convierte el texto con "## Título" en HTML seguro
  function toHtml(text, esc) {
    return text.split('\n\n').map((block) => {
      const m = block.match(/^## (.+)\n([\s\S]*)$/);
      return m ? `<h3>${esc(m[1])}</h3><p>${esc(m[2].replace(/\s+/g, ' ').trim())}</p>` : `<p>${esc(block)}</p>`;
    }).join('');
  }
  const words = (t) => t.replace(/##[^\n]*/g, '').split(/\s+/).filter(Boolean).length;


  /* ───── Informe de scouting del rival, fase a fase ───── */
  function scoutReport(rival, round) {
    const r = rng('scout:' + rival.id + ':' + round);
    const m = rival.model; const ps = rival.players;
    const A = (p, a) => p.attrs[a];
    const nm = (p) => p.name;
    const of = (line) => ps.filter((p) => TC.POSITIONS[p.pos].line === line);
    const best = (list, a) => list.slice().sort((x, y) => A(y, a) - A(x, a))[0];
    const worst = (list, a) => list.slice().sort((x, y) => A(x, a) - A(y, a))[0];
    const top = (list) => list.slice().sort((x, y) => TC.playerRating(y) - TC.playerRating(x));
    const D = top(of('def')), M = top(of('mid')), F = top(of('att')), GK = top(of('gk'))[0];
    const cbs = D.filter((p) => p.pos === 'DFC'), fbs = D.filter((p) => p.pos !== 'DFC');
    const piv = M.filter((p) => p.pos === 'MCD')[0] || M[0];
    const lvl = (v) => (v >= 75 ? 'excelente' : v >= 66 ? 'notable' : v >= 58 ? 'aceptable' : 'deficiente');
    const slowCb = worst(cbs.length ? cbs : D, 'velocidad'); const badPassCb = worst(cbs.length ? cbs : D, 'pase');
    const fastF = best(F.concat(fbs), 'velocidad'); const aerial = best(ps.filter((p) => p.pos !== 'POR'), 'aereo');
    const creator = best(M, 'pase'); const dribbler = best(F, 'regate'); const finisher = best(F, 'finalizacion');
    const tiredMid = worst(M, 'resistencia'); const lazy = worst(F.concat(M), 'intDefensiva');
    const avgL = (list, a) => Math.round(TC.avg(list.map((p) => A(p, a))));
    const T = {};
    T.salida = `Su portero, ${GK ? nm(GK) : '—'}, tiene un juego con los pies ${lvl(GK ? A(GK, 'pase') : 60)}. ${m.buildUp === 'corto' ? `Inician casi siempre en corto: los centrales se abren ${m.cbHeight === 'alta' ? 'muy altos, casi a la altura del pivote' : 'a la altura del área'} y ${nm(piv)} baja a recibir ${m.pivots === 'entre centrales' ? 'entre ellos' : 'por delante'}.` : m.buildUp === 'directo' ? `Apenas arriesgan: el balón largo buscando a ${nm(aerial)} y a las segundas jugadas es su recurso principal.` : `Alternan: si no les presionan salen en corto; ante presión alta, el portero busca el balón largo a ${nm(aerial)}.`} ${nm(badPassCb)} es el central que peor saca el balón (pase ${lvl(A(badPassCb, 'pase'))}); cuando la recibe con presión suele jugar hacia atrás o en largo. ${m.fullbacks === 'interiores' ? 'Los laterales se meten por dentro para dar un apoyo más en la salida.' : m.fullbacks === 'profundos' ? 'Los laterales se proyectan muy pronto y dejan a los centrales solos en la salida.' : 'Los laterales se quedan en la salida para ofrecer líneas de pase cortas.'}`;
    T.progresion = `Progresan ${m.progression === 'interior' ? 'sobre todo por dentro' : m.progression === 'exterior' ? 'sobre todo por fuera, buscando a los laterales y a los extremos' : 'por dentro y por fuera, según dónde encuentran ventaja'} con un ritmo ${m.tempo}. La estructura con balón es ${m.attStructure}, ocupando ${m.width} carril${m.width === '1' ? '' : 'es'} con amplitud. El que más pases da entre líneas es ${nm(creator)} (pase ${lvl(A(creator, 'pase'))}, visión ${lvl(A(creator, 'percepcion'))}); si se le niega el balón, el equipo pierde fluidez. ${tiredMid ? `${nm(tiredMid)} acusa el desgaste: su resistencia es ${lvl(A(tiredMid, 'resistencia'))} y en las segundas partes deja de dar apoyos.` : ''}`;
    T.ultimo = `En el último tercio ${m.finishing === 'centros' ? 'abusan del centro lateral, buscando el remate de ' + nm(aerial) : m.finishing === 'juego interior' ? 'buscan combinar por dentro, paredes y pases filtrados al espacio' : 'buscan la llegada de segunda línea al borde del área'}. ${nm(finisher)} es su mejor rematador (finalización ${lvl(A(finisher, 'finalizacion'))}) y ${nm(dribbler)} es el que más desequilibra en el uno contra uno (regate ${lvl(A(dribbler, 'regate'))}). ${r.pick(['Llegan pocos jugadores al área: rara vez más de dos.', 'Cuando atacan con muchos, dejan poca gente por detrás del balón.', 'Muchos de sus ataques terminan en tiros lejanos, sin profundidad.'])}`;
    const hi = m.blockHeight === 'alto', lo = m.blockHeight === 'bajo';
    T.bloqueAlto = hi ? `Es su altura preferida. Presionan ${m.pressType === 'al hombre' ? 'al hombre, emparejándose con cada rival' : m.pressType === 'mixta' ? 'de forma mixta: zona con saltos al hombre' : 'en zona'} y orientan la presión ${m.pressOrientation}. ${nm(F[0])} lidera la primera presión. La línea defensiva se adelanta (${m.depthControl}) y ${nm(slowCb)}, con velocidad ${lvl(A(slowCb, 'velocidad'))}, sufre cuando le atacan la espalda.` : `Solo presionan arriba de forma puntual, tras un saque de banda o un pase atrás. Cuando lo hacen, saltan desordenados y queda espacio a la espalda de los mediocentros. Su capacidad para repetir esfuerzos es ${lvl(avgL(F.concat(M), 'repetir'))}.`;
    T.bloqueMedio = `${m.blockHeight === 'medio' ? 'Es su bloque habitual.' : 'Lo usan como transición entre presión y repliegue.'} Sistema sin balón ${m.defStructure}. Basculan ${m.coverage === 'basculación amplia' ? 'mucho hacia el lado del balón y dejan libre el lado débil' : m.coverage === 'permutas' ? 'con permutas entre líneas, lo que a veces deja un hueco' : 'con coberturas cortas y líneas muy juntas'}. ${lazy ? `${nm(lazy)} no siempre vuelve a defender (interpretación defensiva ${lvl(A(lazy, 'intDefensiva'))}).` : ''} Su capacidad de concentración media es ${lvl(avgL(ps, 'concentracion'))}.`;
    T.bloqueBajo = lo ? `Es su seña de identidad: defienden muy cerca del área, con las líneas juntas, y esperan el error. Son fuertes por arriba (juego aéreo medio de la defensa: ${lvl(avgL(D, 'aereo'))}), pero conceden centros y disparos desde la frontal.` : `No les gusta defender cerca de su área. Cuando les obligan, se desordenan: los laterales se quedan a media altura y los centros al segundo palo les hacen mucho daño. La defensa tiene un juego aéreo ${lvl(avgL(D, 'aereo'))}.`;
    T.transOf = `Al recuperar ${m.afterRecovery === 'contraataque' ? 'buscan la verticalidad inmediata: el balón va enseguida a ' + nm(fastF) + ', su jugador más rápido' : m.afterRecovery === 'ataque rápido' ? 'intentan atacar rápido, pero si no hay ventaja reorganizan' : 'priorizan conservar: el primer pase es seguro y vuelven a organizarse'}. ${nm(fastF)} tiene una velocidad ${lvl(A(fastF, 'velocidad'))} y aceleración ${lvl(A(fastF, 'aceleracion'))}.`;
    T.transDef = `Tras perder el balón ${m.afterLoss === 'presión inmediata' ? 'presionan de inmediato con los más cercanos' : m.afterLoss === 'repliegue' ? 'repliegan enseguida detrás del balón' : 'dudan entre presionar y replegar, y a veces ni una cosa ni otra'}. Dejan atrás unas vigilancias ${m.restDefense}. ${m.fullbacks === 'profundos' ? 'Con los laterales tan arriba, la espalda de los laterales queda libre tras pérdida.' : 'El equipo queda bastante equilibrado tras pérdida.'}`;
    T.abpOf = `En los córneres van ${m.cornerOf === 'primer palo' ? 'al primer palo' : m.cornerOf === 'segundo palo' ? 'al segundo palo' : 'en corto o con jugada ensayada'}. ${nm(aerial)} es su principal rematador (juego aéreo ${lvl(A(aerial, 'aereo'))}). Faltas: ${m.freeKicks || 'directas'}.`;
    T.abpDef = `Defienden los córneres con un marcaje ${m.cornerDef || 'mixto'}. ${worst(ps.filter((p) => p.pos !== 'POR'), 'aereo') ? `${nm(worst(ps.filter((p) => p.pos !== 'POR' && p.height), 'aereo'))} es el que peor defiende por arriba.` : ''} Su concentración en las acciones a balón parado es ${lvl(avgL(D, 'concentracion'))}.`;
    const intro = `Informe del cuerpo técnico sobre ${rival.name} para la semana ${round}. Sistema base sin balón ${m.defStructure}, con balón ${m.attStructure}. Lee cada fase y decide qué aprovechar y qué neutralizar: no todo lo que aparece aquí es igual de importante.`;
    return { intro, moments: T };
  }

  G.TCStories = { clubHistory, playerStory, toHtml, words, squadFacts, scoutReport };
})(typeof window !== 'undefined' ? window : globalThis);
