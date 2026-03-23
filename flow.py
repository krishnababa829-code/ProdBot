import asyncio
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()


def suggested_keywords():
    return {
        "most common": ["ignite", "demo", "showtime"],
        "most wow": ["lightspeed", "overdrive", "supernova"],
        "risk-free": ["safe", "sandbox", "mock"],
        "executive": ["briefing", "spotlight", "summit"],
        "playful": ["abracadabra", "cheers", "letsgosomewhere"]
    }


async def run_happy_path():
    steps = [
        "Authenticate to the service",
        "Create demo resource",
        "Process data and generate report",
        "Render results with visuals",
        "Archive artifacts and emit summary"
    ]

    console.print("\n[bold green]🚀 Running demo happy path...[/bold green]\n")
    for step in steps:
        await _run_step(step)
    console.print("\n[bold green]✅ Demo completed without prompts![/bold green]\n")


async def _run_step(label: str):
    with Progress(
        SpinnerColumn(),
        TextColumn("{task.description}"),
        transient=True,
        console=console,
    ) as progress:
        task = progress.add_task(f"→ {label} ...", total=None)
        await asyncio.sleep(0.8)
        progress.update(task, description=f"→ {label} ... done")
        await asyncio.sleep(0.15)
