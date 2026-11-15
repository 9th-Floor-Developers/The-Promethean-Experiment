# Inspiration

What if intelligence isn't an inevitable outcome of evolution, but an extraordinarily expensive accident?

One possible explanation for the apparent absence of extraterrestrial civilizations is that intelligence may not be evolutionarily advantageous. Developing sophisticated cognitive capabilities requires energy, resources, and biological complexity, potentially outweighing the benefits they provide to survival and reproduction.

This question inspired **The Promethean Experiment**: an attempt to explore whether intelligence can emerge naturally through evolution, and under what circumstances it becomes advantageous.

Rather than explicitly programming intelligence into an artificial organism, we wanted to create an environment where intelligence could emerge as a consequence of evolutionary pressures.

# What it does

The Promethean Experiment is an artificial-life simulation designed to investigate the emergence and evolutionary utility of intelligence.

Organisms inhabit an isolated environment where they must survive, acquire resources, and reproduce. Their characteristics and behavioral capabilities are influenced by evolutionary processes, allowing populations to adapt over successive generations.

The experiment is designed around a central principle: **intelligence should not be directly rewarded simply for existing.** Instead, it should have meaningful costs and provide potential benefits through the behaviors it enables.

By observing the resulting populations, we aim to investigate questions such as:

- Does intelligence emerge independently through natural selection?
- Does greater intelligence improve survival or reproductive success?
- At what point do the energetic costs of intelligence outweigh its benefits?
- Can relatively simple organisms outperform more intelligent ones?
- What environmental conditions favor the emergence of intelligence?

The simulation also incorporates statistical analysis, including population dynamics, mortality, evolutionary trends, and intelligence-related metrics, allowing us to examine the experiment beyond simply observing the organisms.

# How we built it

We approached the project as both a software engineering challenge and an experiment in artificial life.

The simulation environment is represented as a three-dimensional island but simulated in two-dimensions, providing a visual ecosystem in which organisms can eventually interact with their surroundings. We developed a custom terrain representation and rendering pipeline to create a stylized, low-poly environment.

The application is built around a modern development stack, with **Kotlin** serving as the foundation for simulation logic and **React, TypeScript, and Three.js** providing the interactive visualization environment.

A major part of the design is separating the underlying simulation from its visualization. This allows the simulation to evolve independently while the interface displays its state, individual organisms, and statistical information.

We also designed the experiment around quantitative observation. Population history, mortality, intelligence distributions, and relationships between intelligence and evolutionary success are intended to provide a more meaningful understanding of the simulation's behavior.

# Challenges we ran into

One of our biggest challenges was defining what intelligence actually means in a simulation.

Intelligence is not a single biological characteristic. It encompasses perception, decision-making, learning, resource acquisition, and the ability to respond effectively to unfamiliar situations. Representing these capabilities computationally while avoiding arbitrary intelligence rewards is a difficult problem.

Another challenge was balancing evolutionary realism with computational feasibility. Artificial organisms need enough behavioral complexity to make intelligence meaningful, but the simulation must remain efficient enough to support large populations and many generations.

We also faced the challenge of designing meaningful measurements. An organism with a more complex neural network is not necessarily more intelligent, and an organism with a higher intelligence score is not necessarily more evolutionarily successful. Distinguishing these concepts is essential to interpreting the results.

Finally, combining a computational simulation with an interactive three-dimensional visualization required careful architectural separation between the simulation, its data, and the rendering environment.

# Accomplishments that we're proud of

We are proud of developing a project that approaches a fundamental question about intelligence through experimentation rather than speculation alone.

The Promethean Experiment brings together artificial life, evolutionary computation, neural networks, ecological modeling, and interactive visualization into a single research-oriented project.

We are particularly proud of the direction of the experiment: intelligence is treated as a potential evolutionary outcome rather than a predetermined objective.

We also established a foundation for observing evolutionary processes quantitatively, with a visualization environment designed to make population dynamics and behavioral changes understandable.

# What we learned

This project challenged us to think about intelligence from an evolutionary perspective rather than simply a computational one.

We learned that intelligence cannot be meaningfully evaluated in isolation from its environment. Its value depends on the problems organisms face, the resources available to them, and the reproductive advantages their behavior provides.

We also gained experience designing simulation architectures, developing three-dimensional visualization systems, and thinking critically about the relationship between computational models and scientific conclusions.

Perhaps most importantly, we learned that **creating a system capable of producing an outcome is fundamentally different from demonstrating why that outcome occurred.** Meaningful conclusions require carefully designed measurements, controlled experiments, and an understanding of the limitations of the model.

# What's next for The Promethean Experiment

We plan to introduce more complex ecological systems. These additions would create more realistic evolutionary pressures and allow us to investigate how intelligence develops in increasingly complicated environments.

We also aim to improve simulation performance and computational efficiency, allowing us to support larger populations, longer evolutionary timelines, and more complex organisms. This would make it possible to observe evolutionary patterns across greater scales and conduct more extensive experiments than our current implementation allows.
