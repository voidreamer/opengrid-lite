"""CLI for ShotGrid Lite."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

try:
    import typer
    from rich.console import Console
    from rich.table import Table
    HAS_CLI = True
except ImportError:
    HAS_CLI = False

if HAS_CLI:
    from opengrid import Studio

    app = typer.Typer(
        name="sgl",
        help="ShotGrid Lite - Lightweight production tracking",
        add_completion=False,
    )
    console = Console()
    
    # Subcommands
    project_app = typer.Typer(help="Project management")
    asset_app = typer.Typer(help="Asset management")
    task_app = typer.Typer(help="Task management")
    
    app.add_typer(project_app, name="project")
    app.add_typer(asset_app, name="asset")
    app.add_typer(task_app, name="task")
    
    def get_db_path() -> str:
        """Get database path from env or default."""
        import os
        return os.environ.get("SGL_DATABASE", "studio.db")
    
    @app.command()
    def init(
        db_path: str = typer.Argument("studio.db", help="Database file path"),
    ) -> None:
        """Initialize a new studio database."""
        if Path(db_path).exists():
            console.print(f"[yellow]Database already exists:[/yellow] {db_path}")
            return
        
        with Studio(db_path):
            pass
        
        console.print(f"[green]Created database:[/green] {db_path}")
    
    # =========================================================================
    # Project commands
    # =========================================================================
    
    @project_app.command("create")
    def project_create(
        name: str = typer.Argument(..., help="Project name"),
        code: str = typer.Option(None, "--code", "-c", help="Project code (default: uppercase name)"),
    ) -> None:
        """Create a new project."""
        code = code or name.upper().replace(" ", "_")
        
        with Studio(get_db_path()) as studio:
            project = studio.create_project(name=name, code=code)
            console.print(f"[green]Created project:[/green] {project.code}")
    
    @project_app.command("list")
    def project_list() -> None:
        """List all projects."""
        with Studio(get_db_path()) as studio:
            projects = studio.find_projects()
            
            table = Table(title="Projects")
            table.add_column("Code", style="cyan")
            table.add_column("Name")
            table.add_column("Status")
            
            for p in projects:
                table.add_row(p.code, p.name, p.status)
            
            console.print(table)
    
    # =========================================================================
    # Asset commands
    # =========================================================================
    
    @asset_app.command("create")
    def asset_create(
        project_code: str = typer.Argument(..., help="Project code"),
        name: str = typer.Argument(..., help="Asset name"),
        asset_type: str = typer.Option("other", "--type", "-t", help="Asset type"),
    ) -> None:
        """Create a new asset."""
        with Studio(get_db_path()) as studio:
            asset = studio.create_asset(
                project=project_code,
                name=name,
                asset_type=asset_type,
            )
            console.print(f"[green]Created asset:[/green] {project_code}/{asset.name}")
    
    @asset_app.command("list")
    def asset_list(
        project_code: str = typer.Argument(..., help="Project code"),
        asset_type: Optional[str] = typer.Option(None, "--type", "-t"),
    ) -> None:
        """List assets in a project."""
        with Studio(get_db_path()) as studio:
            assets = studio.find_assets(project=project_code, asset_type=asset_type)
            
            table = Table(title=f"Assets in {project_code}")
            table.add_column("Name", style="cyan")
            table.add_column("Type")
            table.add_column("Status")
            
            for a in assets:
                table.add_row(a.name, a.asset_type, a.status)
            
            console.print(table)
    
    # =========================================================================
    # Task commands
    # =========================================================================
    
    @task_app.command("create")
    def task_create(
        entity_path: str = typer.Argument(..., help="Entity path (PROJECT/asset_name)"),
        name: str = typer.Argument(..., help="Task name"),
        assignee: Optional[str] = typer.Option(None, "--assignee", "-a"),
    ) -> None:
        """Create a new task."""
        parts = entity_path.split("/")
        if len(parts) != 2:
            console.print("[red]Invalid entity path. Use: PROJECT/asset_name[/red]")
            raise typer.Exit(1)
        
        project_code, asset_name = parts
        
        with Studio(get_db_path()) as studio:
            asset = studio.get_asset(project_code, asset_name)
            if not asset:
                console.print(f"[red]Asset not found:[/red] {entity_path}")
                raise typer.Exit(1)
            
            task = studio.create_task(
                entity=asset,
                name=name,
                assignee=assignee,
            )
            console.print(f"[green]Created task:[/green] {entity_path}/{task.name}")
    
    @task_app.command("update")
    def task_update(
        task_path: str = typer.Argument(..., help="Task path (PROJECT/asset/task)"),
        status: Optional[str] = typer.Option(None, "--status", "-s"),
        assignee: Optional[str] = typer.Option(None, "--assignee", "-a"),
    ) -> None:
        """Update a task."""
        parts = task_path.split("/")
        if len(parts) != 3:
            console.print("[red]Invalid task path. Use: PROJECT/asset_name/task_name[/red]")
            raise typer.Exit(1)
        
        project_code, asset_name, task_name = parts
        
        with Studio(get_db_path()) as studio:
            asset = studio.get_asset(project_code, asset_name)
            if not asset:
                console.print(f"[red]Asset not found[/red]")
                raise typer.Exit(1)
            
            tasks = studio.find_tasks(entity=asset)
            task = next((t for t in tasks if t.name == task_name), None)
            
            if not task:
                console.print(f"[red]Task not found:[/red] {task_name}")
                raise typer.Exit(1)
            
            studio.update_task(task, status=status, assignee=assignee)
            console.print(f"[green]Updated task:[/green] {task_path}")
    
    @task_app.command("list")
    def task_list(
        project_code: str = typer.Argument(..., help="Project code"),
        status: Optional[str] = typer.Option(None, "--status", "-s"),
        assignee: Optional[str] = typer.Option(None, "--assignee", "-a"),
    ) -> None:
        """List tasks in a project."""
        with Studio(get_db_path()) as studio:
            # Get all assets in project
            assets = studio.find_assets(project=project_code)
            
            table = Table(title=f"Tasks in {project_code}")
            table.add_column("Asset", style="cyan")
            table.add_column("Task")
            table.add_column("Status")
            table.add_column("Assignee")
            
            for asset in assets:
                tasks = studio.find_tasks(entity=asset, status=status, assignee=assignee)
                for t in tasks:
                    table.add_row(asset.name, t.name, t.status, t.assignee or "-")
            
            console.print(table)

else:
    def app():
        print("CLI dependencies not installed. Run: pip install shotgrid-lite[cli]")


def main() -> None:
    """Entry point."""
    if HAS_CLI:
        app()
    else:
        print("CLI dependencies not installed. Run: pip install shotgrid-lite[cli]")


if __name__ == "__main__":
    main()
