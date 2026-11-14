import sim.world.*
object Bench { @JvmStatic fun main(a: Array<String>) {
    val w = createWorld(42, 200, listOf(SpeciesSetup(MOCK_CARNIVORE, 300), SpeciesSetup(MOCK_HERBIVORE, 2700)))
    val out = System.out
    System.setOut(java.io.PrintStream(java.io.OutputStream.nullOutputStream()))
    repeat(20) { w.tick() }
    repeat(5) { val t = System.nanoTime(); repeat(20) { w.tick() }; out.println("20 ticks: ${(System.nanoTime()-t)/1_000_000} ms, animals=${w.animals.size}") }
} }
